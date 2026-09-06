import { showNotification } from "../../ui/notification";
import type { CopyMessageRenderDeps } from "./copyMessages";
import { formatActionExecutionMessage } from "./interaction/presentation/copyActionMessages";
import type { ClipboardResult } from "./types";

export function formatCopyMessage(
  result: ClipboardResult,
  deps: CopyMessageRenderDeps = {},
): string {
  return formatActionExecutionMessage(result, deps);
}

export function getCopyNotificationOptions(result: ClipboardResult): {
  closeTime: number;
} {
  return {
    closeTime: result.outcome === "copied-path-text-fallback" ? 7000 : 5000,
  };
}

export function notifyCopyResult(result: ClipboardResult): void {
  showNotification(
    formatCopyMessage(result),
    getCopyNotificationOptions(result).closeTime,
  );
}
