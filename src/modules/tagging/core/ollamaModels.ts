import type { AiProviderModel } from "../../../utils/prefs";
import { parseModelListResponse } from "./modelParser";

/**
 * Parse the JSON response from Ollama's `/api/tags` endpoint into the
 * provider-agnostic model list used by the preferences UI.
 */
export function parseOllamaTagsResponse(raw: string): AiProviderModel[] {
  return parseModelListResponse(raw, "models", "name", "Ollama");
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
