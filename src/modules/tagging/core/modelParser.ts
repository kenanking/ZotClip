import type { AiProviderModel } from "../../../utils/prefs";

/**
 * Generic parser for model-list JSON responses.
 *
 * @param raw         Raw JSON string from the provider endpoint.
 * @param arrayKey    Top-level key that holds the model array (e.g. "models", "data").
 * @param nameKey     Property on each array element containing the model id/name.
 * @param providerLabel Human-readable provider name for error messages.
 */
export function parseModelListResponse(
  raw: string,
  arrayKey: string,
  nameKey: string,
  providerLabel: string,
): AiProviderModel[] {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse ${providerLabel} response: invalid JSON`);
  }

  if (!parsed || !Array.isArray(parsed[arrayKey])) {
    throw new Error(
      `Failed to parse ${providerLabel} response: unexpected shape`,
    );
  }

  const items = parsed[arrayKey] as Record<string, unknown>[];
  return items
    .filter(
      (m) => typeof m[nameKey] === "string" && (m[nameKey] as string).trim(),
    )
    .map((m) => ({ value: m[nameKey] as string, label: m[nameKey] as string }));
}
