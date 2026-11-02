//! Sends the webview's requests to model providers: only to the provider's own address, with only the headers it needs, and with the key added from the keychain.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use tokio::sync::oneshot;

use crate::keys;

#[derive(Default)]
pub struct PendingApiKeys(pub Mutex<HashMap<String, String>>);

#[derive(Default)]
pub struct InFlight(Mutex<HashMap<String, oneshot::Sender<()>>>);

pub struct Http(Option<Client>);

impl Default for Http {
    fn default() -> Self {
        Self(
            Client::builder()
                .connect_timeout(CONNECT_TIMEOUT)
                .read_timeout(READ_TIMEOUT)
                // A redirect could lead away from the provider, taking the key with it.
                .redirect(reqwest::redirect::Policy::none())
                .user_agent(concat!("ArchStudio/", env!("CARGO_PKG_VERSION")))
                .build()
                .ok(),
        )
    }
}

#[derive(Deserialize)]
pub struct Request {
    id: String,
    provider: String,
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ResponseEvent {
    Head {
        status: u16,
        headers: Vec<(String, String)>,
    },
    Chunk {
        bytes: Vec<u8>,
    },
    /// The whole answer has been sent. The command's own result can reach the webview before the last parts do.
    Done,
}

const CONNECT_TIMEOUT: Duration = Duration::from_secs(20);
const READ_TIMEOUT: Duration = Duration::from_secs(120);

/// Headers the webview may send. Any that name a key are dropped: the key is added here.
const SENT: [&str; 7] = [
    "accept",
    "content-type",
    "anthropic-version",
    "anthropic-beta",
    "openai-beta",
    "openai-organization",
    "openai-project",
];
const RETURNED: [&str; 4] = ["content-type", "retry-after", "request-id", "x-request-id"];

/// A provider is only reached at its own address, so the key cannot be sent anywhere else.
fn destination(provider: &str, url: &str) -> Result<Url, String> {
    let url = Url::parse(url).map_err(|_| "That is not a web address.".to_string())?;
    let host = url.host_str().unwrap_or_default();
    let allowed = match provider {
        "anthropic" => url.scheme() == "https" && host == "api.anthropic.com",
        "openai" => url.scheme() == "https" && host == "api.openai.com",
        _ => return Err("Unknown provider.".into()),
    };
    if !allowed || !url.username().is_empty() || url.password().is_some() {
        return Err(format!("Requests for {provider} cannot go to {host}."));
    }
    Ok(url)
}

fn kept(headers: Vec<(String, String)>, allowed: &[&str]) -> Vec<(String, String)> {
    headers
        .into_iter()
        .filter(|(name, _)| allowed.contains(&name.to_ascii_lowercase().as_str()))
        .collect()
}

fn credentials(
    app: &AppHandle,
    held: &PendingApiKeys,
    provider: &str,
) -> Result<(&'static str, String), String> {
    let trying = held
        .0
        .lock()
        .map_err(|_| "Could not read the key.".to_string())?
        .get(provider)
        .cloned();
    let key = match trying {
        Some(key) => key,
        None => keys::saved(app, provider)?,
    };
    Ok(match provider {
        "anthropic" => ("x-api-key", key),
        _ => ("authorization", format!("Bearer {key}")),
    })
}

#[tauri::command]
pub async fn provider_request(
    app: AppHandle,
    http: State<'_, Http>,
    held: State<'_, PendingApiKeys>,
    in_flight: State<'_, InFlight>,
    request: Request,
    on_part: Channel<ResponseEvent>,
) -> Result<(), String> {
    let id = request.id.clone();
    let (call_off, called_off) = oneshot::channel();
    if let Ok(mut requests) = in_flight.0.lock() {
        requests.insert(id.clone(), call_off);
    }
    // Dropping the request is what cancels it.
    let outcome = tokio::select! {
        outcome = send(&app, &http, &held, request, &on_part) => outcome,
        _ = called_off => Err("The request was cancelled.".to_string()),
    };
    if let Ok(mut requests) = in_flight.0.lock() {
        requests.remove(&id);
    }
    outcome
}

#[tauri::command]
pub fn cancel_provider_request(in_flight: State<InFlight>, id: String) {
    if let Some(call_off) = in_flight
        .0
        .lock()
        .ok()
        .and_then(|mut requests| requests.remove(&id))
    {
        let _ = call_off.send(());
    }
}

async fn send(
    app: &AppHandle,
    http: &Http,
    held: &PendingApiKeys,
    request: Request,
    on_part: &Channel<ResponseEvent>,
) -> Result<(), String> {
    let url = destination(&request.provider, &request.url)?;
    let host = url.host_str().unwrap_or_default().to_string();
    let method = match request.method.as_str() {
        "GET" => Method::GET,
        "POST" => Method::POST,
        _ => return Err("Only GET and POST requests are made to providers.".into()),
    };
    let client = http
        .0
        .as_ref()
        .ok_or_else(|| "Could not start a network request.".to_string())?;

    let mut sending = client.request(method, url);
    for (name, value) in kept(request.headers, &SENT) {
        sending = sending.header(name, value);
    }
    let (name, value) = credentials(app, held, &request.provider)?;
    sending = sending.header(name, value);
    if let Some(body) = request.body {
        sending = sending.body(body);
    }

    // The error itself can carry the address and its query, so it is not passed on.
    let unreachable = |error: reqwest::Error| {
        if error.is_timeout() {
            format!("{host} did not answer in time.")
        } else {
            format!("Could not reach {host}.")
        }
    };
    let mut response = sending.send().await.map_err(unreachable)?;
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| Some((name.to_string(), value.to_str().ok()?.to_string())))
        .collect();
    let gone = |_| "The app stopped listening for the answer.".to_string();
    on_part
        .send(ResponseEvent::Head {
            status: response.status().as_u16(),
            headers: kept(headers, &RETURNED),
        })
        .map_err(gone)?;
    while let Some(chunk) = response.chunk().await.map_err(unreachable)? {
        on_part
            .send(ResponseEvent::Chunk {
                bytes: chunk.to_vec(),
            })
            .map_err(gone)?;
    }
    on_part.send(ResponseEvent::Done).map_err(gone)
}

#[cfg(test)]
mod tests {
    use super::{destination, kept, SENT};

    #[test]
    fn a_provider_is_only_reached_at_its_own_address() {
        assert!(destination("anthropic", "https://api.anthropic.com/v1/messages").is_ok());
        assert!(destination("openai", "https://api.openai.com/v1/responses").is_ok());
        for (provider, url) in [
            (
                "anthropic",
                "https://api.anthropic.com.evil.example/v1/messages",
            ),
            ("anthropic", "http://api.anthropic.com/v1/messages"),
            ("anthropic", "https://api.openai.com/v1/responses"),
            ("openai", "https://example.com/"),
            ("openai", "https://user:pass@api.openai.com/v1/responses"),
            ("someone", "https://api.openai.com/v1/responses"),
            ("openai", "not an address"),
        ] {
            assert!(destination(provider, url).is_err(), "{provider} {url}");
        }
    }

    #[test]
    fn the_webview_cannot_send_a_key_of_its_own() {
        let headers = vec![
            ("Content-Type".to_string(), "application/json".to_string()),
            ("x-api-key".to_string(), "placeholder".to_string()),
            (
                "Authorization".to_string(),
                "Bearer placeholder".to_string(),
            ),
            ("anthropic-version".to_string(), "2023-06-01".to_string()),
            ("Cookie".to_string(), "session=1".to_string()),
        ];
        let names: Vec<String> = kept(headers, &SENT)
            .into_iter()
            .map(|(name, _)| name)
            .collect();
        assert_eq!(names, ["Content-Type", "anthropic-version"]);
    }
}
