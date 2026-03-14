import type {
  ClipboardFormat,
  ClipboardOutcome,
  ClipboardResult,
} from "../types";
import type { BackendAvailability, ClipboardPayload } from "./types";

export interface ClipboardBackend {
  id: string;
  priority: number;
  isAvailable(payload: ClipboardPayload): Promise<BackendAvailability>;
  write(payload: ClipboardPayload): Promise<ClipboardResult>;
}

export function sortClipboardBackends(
  backends: ClipboardBackend[],
): ClipboardBackend[] {
  return [...backends].sort((left, right) => right.priority - left.priority);
}

/**
 * Build a success result for clipboard write operations.
 */
export function buildSuccessResult(
  payload: ClipboardPayload,
  format: ClipboardFormat,
  outcome: ClipboardOutcome,
): ClipboardResult {
  return {
    ok: true,
    count: payload.paths.length,
    format,
    outcome,
  };
}

/**
 * Build a failure result for clipboard write operations.
 */
export function buildFailureResult(
  payload: ClipboardPayload,
  message?: string,
): ClipboardResult {
  return {
    ok: false,
    count: payload.paths.length,
    format: "none",
    outcome: "copy-failed",
    message: message || "Clipboard write failed.",
  };
}
