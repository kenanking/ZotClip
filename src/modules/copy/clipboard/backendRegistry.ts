import type { ClipboardResult } from "../types";
import type { ClipboardBackend } from "./backends";
import type { ClipboardPayload } from "./types";
import { sortClipboardBackends } from "./backends";

export async function runClipboardBackends(input: {
  payload: ClipboardPayload;
  backends: ClipboardBackend[];
}): Promise<ClipboardResult> {
  const orderedBackends = sortClipboardBackends(input.backends);

  for (const backend of orderedBackends) {
    const availability = await backend.isAvailable(input.payload);
    if (!availability.available) {
      continue;
    }

    const result = await backend.write(input.payload);
    if (result.ok) {
      return result;
    }
  }

  return {
    ok: false,
    count: input.payload.paths.length,
    format: "none",
    outcome: "copy-failed",
    message: "Clipboard write failed.",
  };
}
