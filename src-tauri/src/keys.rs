//! API keys in the operating system's credential store. Nothing here returns a key to the webview.

use keyring::Entry;
use tauri::{AppHandle, State};

use crate::proxy::PendingApiKeys;

/// The only providers a key is kept for, so the webview cannot write under a name of its choosing.
const PROVIDERS: [&str; 2] = ["anthropic", "openai"];

const KEY_LENGTH: std::ops::RangeInclusive<usize> = 20..=512;

fn looks_like_a_key(key: &str) -> bool {
    KEY_LENGTH.contains(&key.len()) && key.chars().all(|character| character.is_ascii_graphic())
}

fn entry(app: &AppHandle, provider: &str) -> Result<Entry, String> {
    if !PROVIDERS.contains(&provider) {
        return Err("Unknown provider.".into());
    }
    // Messages never include what the credential store reported, which may name the key.
    Entry::new(&app.config().identifier, provider)
        .map_err(|_| "The system keychain is not available.".to_string())
}

pub fn saved(app: &AppHandle, provider: &str) -> Result<String, String> {
    entry(app, provider)?
        .get_password()
        .map_err(|error| match error {
            keyring::Error::NoEntry => "No API key is saved for this provider.".to_string(),
            _ => "The system keychain could not be read.".to_string(),
        })
}

fn held<'a>(
    keys: &'a State<PendingApiKeys>,
) -> Result<std::sync::MutexGuard<'a, std::collections::HashMap<String, String>>, String> {
    keys.0
        .lock()
        .map_err(|_| "Could not read the key.".to_string())
}

#[tauri::command]
pub fn hold_api_key(
    keys: State<PendingApiKeys>,
    provider: String,
    key: String,
) -> Result<(), String> {
    let key = key.trim();
    if !PROVIDERS.contains(&provider.as_str()) {
        return Err("Unknown provider.".into());
    }
    if !looks_like_a_key(key) {
        return Err("That does not look like an API key.".into());
    }
    held(&keys)?.insert(provider, key.to_string());
    Ok(())
}

#[tauri::command]
pub fn save_api_key(
    app: AppHandle,
    keys: State<PendingApiKeys>,
    provider: String,
) -> Result<(), String> {
    let key = held(&keys)?
        .remove(&provider)
        .ok_or_else(|| "There is no key to save.".to_string())?;
    entry(&app, &provider)?
        .set_password(&key)
        .map_err(|_| "Could not save the key to the system keychain.".to_string())
}

#[tauri::command]
pub fn discard_api_key(keys: State<PendingApiKeys>, provider: String) -> Result<(), String> {
    held(&keys)?.remove(&provider);
    Ok(())
}

#[tauri::command]
pub fn delete_api_key(app: AppHandle, provider: String) -> Result<(), String> {
    match entry(&app, &provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Could not remove the key from the system keychain.".into()),
    }
}

// Only whether a key is saved, not the key itself: on macOS reading a key asks the user's permission, and a
// development build is a new app to the keychain each time it is rebuilt.
#[cfg(target_os = "macos")]
fn is_saved(app: &AppHandle, provider: &str) -> Result<bool, String> {
    use security_framework::item::{ItemClass, ItemSearchOptions, Limit};
    const NOT_FOUND: i32 = -25300;
    match ItemSearchOptions::new()
        .class(ItemClass::generic_password())
        .service(&app.config().identifier)
        .account(provider)
        .load_attributes(true)
        .limit(Limit::Max(1))
        .search()
    {
        Ok(found) => Ok(!found.is_empty()),
        Err(error) if error.code() == NOT_FOUND => Ok(false),
        Err(_) => Err("The system keychain could not be read.".into()),
    }
}

#[cfg(not(target_os = "macos"))]
fn is_saved(app: &AppHandle, provider: &str) -> Result<bool, String> {
    match entry(app, provider)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(_) => Err("The system keychain could not be read.".into()),
    }
}

#[tauri::command]
pub fn stored_api_keys(app: AppHandle) -> Result<Vec<String>, String> {
    let mut stored = Vec::new();
    for provider in PROVIDERS {
        if is_saved(&app, provider)? {
            stored.push(provider.to_string());
        }
    }
    Ok(stored)
}

#[cfg(test)]
mod tests {
    use super::looks_like_a_key;

    #[test]
    fn accepts_keys_of_the_usual_shapes() {
        assert!(looks_like_a_key(
            "sk-ant-api03-abcdefghijklmnopqrstuvwxyz_0123456789-ABCD"
        ));
        assert!(looks_like_a_key(
            "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789"
        ));
    }

    #[test]
    fn rejects_what_could_not_be_a_key() {
        assert!(!looks_like_a_key(""));
        assert!(!looks_like_a_key("too-short"));
        assert!(!looks_like_a_key(
            "sk-ant-api03 with a space in the middle of it"
        ));
        assert!(!looks_like_a_key(
            "sk-ant-api03-line\nbreak-abcdefghijklmnop"
        ));
        assert!(!looks_like_a_key(&"k".repeat(513)));
    }
}
