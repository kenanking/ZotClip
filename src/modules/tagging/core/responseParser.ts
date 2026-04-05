export function sanitizeAiJsonResponse(raw: string): string {
  let s = raw.trim();
  const fenceMatch = s.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    s = fenceMatch[1].trim();
  }
  return s;
}

export function parseAutoTagResponse(raw: string): { tags: string[] } {
  const sanitized = sanitizeAiJsonResponse(raw);
  const parsed = JSON.parse(sanitized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Response is not a JSON object with a tags array");
  }
  if (!("tags" in parsed)) {
    return { tags: [] };
  }
  if (!Array.isArray(parsed.tags)) {
    throw new Error("Response is not a JSON object with a tags array");
  }
  return {
    tags: parsed.tags
      .filter(
        (t: unknown): t is string =>
          typeof t === "string" && t.trim().length > 0,
      )
      .map((t: string) => t.trim()),
  };
}
