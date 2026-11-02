import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

// The webview has no network access and cannot read a saved key back: the native layer makes each request and adds the key.

export const isDesktop = () => isTauri();

export const storedApiKeys = () => invoke<string[]>("stored_api_keys");

export const holdApiKey = (provider: string, key: string) => invoke<void>("hold_api_key", { provider, key });
export const saveApiKey = (provider: string) => invoke<void>("save_api_key", { provider });
export const discardApiKey = (provider: string) => invoke<void>("discard_api_key", { provider });
export const deleteApiKey = (provider: string) => invoke<void>("delete_api_key", { provider });

type ResponseEvent =
  | { type: "head"; status: number; headers: [string, string][] }
  | { type: "chunk"; bytes: number[] }
  | { type: "done" };

export function nativeFetch(provider: string): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const { signal } = request;
    signal.throwIfAborted();
    const body = request.method === "GET" ? undefined : await request.text();
    signal.throwIfAborted();
    const id = crypto.randomUUID();
    let over = false;
    const cancel = () => {
      over = true;
      void invoke("cancel_provider_request", { id });
    };
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const answer = new ReadableStream<Uint8Array>({
      start(controller) {
        stream = controller;
      },
      cancel,
    });

    return new Promise<Response>((resolve, reject) => {
      const onPart = new Channel<ResponseEvent>();
      const stop = (error: unknown) => {
        if (over) return;
        over = true;
        stream.error(error);
        reject(error);
      };
      signal.addEventListener(
        "abort",
        () => {
          stop(signal.reason);
          cancel();
        },
        { once: true },
      );
      onPart.onmessage = (part) => {
        if (over) return;
        if (part.type === "chunk") stream.enqueue(new Uint8Array(part.bytes));
        else if (part.type === "done") {
          over = true;
          stream.close();
        }
        // A response with no content may not be given a body at all.
        else resolve(new Response([204, 304].includes(part.status) ? null : answer, part));
      };
      const sent = { id, provider, url: request.url, method: request.method, headers: [...request.headers], body };
      // Only "done" ends the answer: the command can return before its larger parts have arrived.
      invoke("provider_request", { request: sent, onPart }).catch((cause: unknown) => stop(new Error(String(cause))));
    });
  };
}
