import { showNotification } from "../../ui/notification";
import { formatCopyResultMessage } from "./copyMessages";
import type { ClipboardResult } from "./types";

export function getCopyNotificationOptions(result: ClipboardResult): {
  closeTime: number;
} {
  return {
    closeTime: result.outcome === "copied-path-text-fallback" ? 7000 : 5000,
  };
}

export function notifyCopyResult(result: ClipboardResult): void {
  showNotification(
    formatCopyResultMessage(result),
    getCopyNotificationOptions(result).closeTime,
  );
}
