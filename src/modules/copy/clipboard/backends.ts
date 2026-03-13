import type { ClipboardResult } from "../types";
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
