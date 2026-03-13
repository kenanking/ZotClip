import { config } from "../../../package.json";
import type { ClipboardResult } from "./types";

export function formatCopyMessage(result: ClipboardResult): string {
  if (result.outcome === "backend-unavailable" && result.message) {
    return result.message;
  }

  if (result.outcome === "copied-files") {
    return `Copied ${result.count} attachment file(s) to clipboard (file-object).`;
  }

  if (result.outcome === "copied-file-uris") {
    return `Copied ${result.count} attachment file URI(s) to clipboard.`;
  }

  if (result.outcome === "copied-path-text-fallback") {
    return `Attachment file copy failed. Copied ${result.count} attachment path(s) instead.`;
  }

  if (result.message && !result.ok) {
    return result.message;
  }

  if (!result.ok) {
    return "Copy failed. Please check file availability and clipboard support in target app.";
  }

  if (result.format === "path-text") {
    return `Attachment file copy failed. Copied ${result.count} attachment path(s) instead.`;
  }

  return `Copied ${result.count} attachment file(s) to clipboard (${result.format}).`;
}

function getCopyResultNotificationIcon(_result: ClipboardResult): string {
  return `chrome://${config.addonRef}/content/icons/favicon.svg`;
}

export function notifyCopyResult(result: ClipboardResult): void {
  const message = formatCopyMessage(result);
  const icon = getCopyResultNotificationIcon(result);
  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeTime: 5000,
  })
    .createLine({
      text: message,
      icon,
      progress: 100,
    })
    .show();
}
