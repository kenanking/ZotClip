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
    let availability;
    try {
      availability = await backend.isAvailable(input.payload);
    } catch (error) {
      logClipboardBackendError(
        "Clipboard backend availability failed",
        backend.id,
        error,
      );
      continue;
    }

    if (!availability.available) {
      continue;
    }

    let result;
    try {
      result = await backend.write(input.payload);
    } catch (error) {
      logClipboardBackendError(
        "Clipboard backend write failed",
        backend.id,
        error,
      );
      continue;
    }

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

function logClipboardBackendError(
  message: string,
  backendID: string,
  error: unknown,
): void {
  (globalThis as any).ztoolkit?.log?.(message, backendID, error);
}
