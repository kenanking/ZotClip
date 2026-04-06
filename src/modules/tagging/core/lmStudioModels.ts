import type { AiProviderModel } from "../../../utils/prefs";
import { parseModelListResponse } from "./modelParser";

/**
 * Parse the JSON response from LM Studio's `/v1/models` endpoint into the
 * provider-agnostic model list used by the preferences UI.
 */
export function parseLmStudioModelsResponse(raw: string): AiProviderModel[] {
  return parseModelListResponse(raw, "data", "id", "LM Studio");
}

/**
 * Fetch available model names from a running LM Studio instance.
 * Throws on network failure so the UI layer can notify the user.
 */
export async function fetchLmStudioModels(
  baseUrl: string,
  httpRequest: (url: string) => Promise<{ response: string }>,
): Promise<AiProviderModel[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/models`;
  const result = await httpRequest(url);
  return parseLmStudioModelsResponse(result.response);
}
