import type { ClipboardResult } from "./types";

export function formatCopyMessage(result: ClipboardResult): string {
  if (result.message && !result.ok) {
    return result.message;
  }

  if (!result.ok) {
    return "Copy failed. Please check file availability and clipboard support in target app.";
  }

  if (result.fallbackUsed && result.format === "path-text") {
    return `Attachment file copy failed. Copied ${result.count} attachment path(s) instead.`;
  }

  return `Copied ${result.count} attachment file(s) to clipboard (${result.format}).`;
}

export function getCopyResultNotificationType(
  result: ClipboardResult,
): "success" | "fail" {
  if (result.ok && !result.fallbackUsed) {
    return "success";
  }
  return "fail";
}

export function notifyCopyResult(result: ClipboardResult): void {
  const message = formatCopyMessage(result);
  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeTime: 5000,
  })
    .createLine({
      text: message,
      type: getCopyResultNotificationType(result),
      progress: 100,
    })
    .show();
}
