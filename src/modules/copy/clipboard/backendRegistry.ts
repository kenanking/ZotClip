import type { ClipboardResult } from "../types";
import { buildFailureResult } from "./backends";
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
      logUnexpectedBackendError("availability check", backend.id, error);
      continue;
    }

    if (!availability.available) {
      // Backend unavailable is expected behavior (e.g., command not installed)
      // Don't log this as an error
      continue;
    }

    let result;
    try {
      result = await backend.write(input.payload);
    } catch (error) {
      logUnexpectedBackendError("write", backend.id, error);
      continue;
    }

    if (result.ok) {
      return result;
    }
  }

  return buildFailureResult(input.payload);
}

/**
 * Log unexpected backend errors (exceptions), not expected unavailability.
 */
function logUnexpectedBackendError(
  operation: string,
  backendID: string,
  error: unknown,
): void {
  // Only log actual exceptions, not expected failures like missing commands
  (
    globalThis as { ztoolkit?: { log?: (...args: unknown[]) => void } }
  ).ztoolkit?.log?.(
    `Clipboard backend ${operation} failed unexpectedly`,
    backendID,
    error,
  );
}
