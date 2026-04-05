import { buildChatRequestBody } from "../core/chatRequest";

/** Shorter than full auto-tag requests so the prefs probe feels snappy. */
export const PROBE_TIMEOUT_MS = 15_000;

const RESPONSE_SNIPPET_MAX = 200;

export function buildProbeRequestBody(
  model: string,
  options: { includeJsonObjectResponseFormat: boolean },
): string {
  return buildChatRequestBody({
    model,
    userMessage: "Hi",
    maxTokens: 1,
    includeJsonObjectResponseFormat: options.includeJsonObjectResponseFormat,
  });
}

export function interpretProbeResponse(
  responseText: string,
  status: number,
): { ok: true } | { ok: false; message: string } {
  const httpOk = status >= 200 && status < 300;
  if (!httpOk) {
    const snippet = responseText.slice(0, RESPONSE_SNIPPET_MAX).trim();
    return {
      ok: false,
      message: snippet || `HTTP ${status}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return { ok: false, message: "Invalid JSON in response" };
  }

  const choices = (parsed as { choices?: unknown })?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return { ok: false, message: "Unexpected response shape" };
  }

  const msg = (choices[0] as { message?: unknown })?.message;
  if (msg == null || typeof msg !== "object") {
    return { ok: false, message: "Unexpected response shape" };
  }

  return { ok: true };
}

export type ProbeHttpPost = (
  url: string,
  options: {
    headers: Record<string, string>;
    body: string;
    timeout: number;
  },
) => Promise<{ response: string; status: number }>;

export async function runAiConnectionProbe(args: {
  url: string;
  apiKey: string;
  apiKeyRequired: boolean;
  model: string;
  includeJsonObjectResponseFormat: boolean;
  httpPost: ProbeHttpPost;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const url = args.url.trim();
  if (!url) {
    return { ok: false, message: "__needs_endpoint__" };
  }

  if (args.apiKeyRequired && !args.apiKey.trim()) {
    return { ok: false, message: "__needs_key__" };
  }

  const model = args.model.trim();
  if (!model) {
    return { ok: false, message: "__needs_model__" };
  }

  const bearer =
    args.apiKey.trim() || (args.apiKeyRequired ? "" : "ollama-no-key");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${bearer}`,
  };

  const body = buildProbeRequestBody(model, {
    includeJsonObjectResponseFormat: args.includeJsonObjectResponseFormat,
  });

  try {
    const { response, status } = await args.httpPost(url, {
      headers,
      body,
      timeout: PROBE_TIMEOUT_MS,
    });
    return interpretProbeResponse(response, status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }
}
