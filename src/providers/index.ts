import { APICallError, generateText } from "ai";
import { anthropic } from "./anthropic";
import type { ModelProvider, ProviderAccess } from "./modelProvider";
import { openai } from "./openai";

export type { ModelDefinition, ModelProvider, ProviderAccess } from "./modelProvider";

export const providers: ModelProvider[] = [anthropic, openai];

const TIMEOUT = 20_000;
const SAID_LENGTH = 200;

function providerErrorMessage(body: string | undefined): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body ?? "");
  } catch {
    return "";
  }
  const error = (parsed as { error?: unknown } | null)?.error;
  const message = typeof error === "string" ? error : (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() ? ` It said: “${message.trim().slice(0, SAID_LENGTH)}”` : "";
}

// A browser cannot read a refusal sent without CORS headers, as OpenAI's is for a key it does not know:
// it looks the same as no connection, so both are mentioned.
const unreachable = ({ label }: ModelProvider) =>
  `${label} gave no answer this app could read. It most likely did not accept the key: check it was copied in full and has not been revoked. If the key is right, check your connection.`;

export function explainError(provider: ModelProvider, model: string, error: unknown): string {
  const { label } = provider;
  // By name: an abort is not always an `Error` of this realm, and may arrive as another's cause.
  const names = [error, (error as { cause?: unknown } | null)?.cause].map(
    (each) => (each as { name?: unknown } | null)?.name,
  );
  if (names.includes("TimeoutError") || names.includes("AbortError"))
    return `${label} did not answer in time. Try again.`;
  if (!APICallError.isInstance(error)) {
    return error instanceof TypeError || !(error instanceof Error) ? unreachable(provider) : error.message;
  }
  const answer = providerErrorMessage(error.responseBody);
  switch (error.statusCode) {
    case undefined:
      return unreachable(provider);
    // What a provider says about a rejected key can show part of it, so it is not repeated.
    case 401:
      return `${label} did not accept this key. Check it was copied in full and has not been revoked.`;
    case 403:
      return `${label} accepted the key, but it is not allowed to use ${model}.${answer}`;
    case 404:
      return `${label} has no model called ${model} for this key.${answer}`;
    case 429:
      return `${label} recognised the key but refused the request: it is rate limited or out of credit.${answer}`;
    default:
      return error.statusCode >= 500
        ? `${label} is having problems right now. Try again shortly.`
        : `${label} refused the request (${error.statusCode}).${answer}`;
  }
}

export async function testConnection(
  provider: ModelProvider,
  access: ProviderAccess,
  signal?: AbortSignal,
): Promise<void> {
  const cheapest = provider.testModel;
  const timeout = AbortSignal.timeout(TIMEOUT);
  const within = { abortSignal: signal ? AbortSignal.any([timeout, signal]) : timeout };
  try {
    await generateText({
      model: provider.languageModel(cheapest, access),
      prompt: "Hi",
      // The least OpenAI accepts.
      maxOutputTokens: 16,
      maxRetries: 0,
      ...within,
    });
  } catch (error) {
    throw new Error(explainError(provider, cheapest, error));
  }
}
