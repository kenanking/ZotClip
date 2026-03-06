export const ATTACHMENT_TYPE_PRESETS = ["pdf", "epub", "mobi", "txt"] as const;

export function normalizeExtensionList(input: string | string[]): string[] {
  const rawValues = Array.isArray(input) ? input : input.split(",");
  const seen = new Set<string>();
  const normalizedValues: string[] = [];

  for (const rawValue of rawValues) {
    const normalizedValue = rawValue.trim().replace(/^\./, "").toLowerCase();
    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
}

export function extractExtensionFromPath(path: string): string | undefined {
  const match = /\.([^.\\/]+)$/.exec(path);
  return match?.[1]?.toLowerCase();
}
