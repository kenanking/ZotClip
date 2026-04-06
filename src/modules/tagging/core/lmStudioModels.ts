import type { AiProviderModel } from "../../../utils/prefs";

export interface LmStudioModelsResponse {
  data: Array<{ id: string }>;
}

/**
 * Parse the JSON response from LM Studio's `/v1/models` endpoint into the
 * provider-agnostic model list used by the preferences UI.
 */
export function parseLmStudioModelsResponse(raw: string): AiProviderModel[] {
  let parsed: LmStudioModelsResponse;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse LM Studio response: invalid JSON");
  }

  if (!parsed || !Array.isArray(parsed.data)) {
    throw new Error("Failed to parse LM Studio response: unexpected shape");
  }

  return parsed.data
    .filter((m) => typeof m.id === "string" && m.id.trim())
    .map((m) => ({ value: m.id, label: m.id }));
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
