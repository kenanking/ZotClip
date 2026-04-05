import type { AiProviderModel } from "../../../utils/prefs";

export interface OllamaTagsResponse {
  models: Array<{ name: string }>;
}

/**
 * Parse the JSON response from Ollama's `/api/tags` endpoint into the
 * provider-agnostic model list used by the preferences UI.
 */
export function parseOllamaTagsResponse(raw: string): AiProviderModel[] {
  let parsed: OllamaTagsResponse;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse Ollama response: invalid JSON");
  }

  if (!parsed || !Array.isArray(parsed.models)) {
    throw new Error("Failed to parse Ollama response: unexpected shape");
  }

  return parsed.models
    .filter((m) => typeof m.name === "string" && m.name.trim())
    .map((m) => ({ value: m.name, label: m.name }));
}

/**
 * Fetch available model names from a running Ollama instance.
 * Throws on network failure so the UI layer can notify the user.
 */
export async function fetchOllamaModels(
  baseUrl: string,
  httpRequest: (url: string) => Promise<{ response: string }>,
): Promise<AiProviderModel[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/tags`;
  const result = await httpRequest(url);
  return parseOllamaTagsResponse(result.response);
}
