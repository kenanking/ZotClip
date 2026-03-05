import type { ClipboardResult } from "./types";

export function formatCopyMessage(result: ClipboardResult): string {
  if (!result.ok) {
    return "Copy failed. Please check file availability and clipboard support in target app.";
  }

  if (result.format === "path-text") {
    return `File clipboard unavailable. Copied ${result.count} file path(s) instead.`;
  }

  return `Copied ${result.count} PDF file(s) to clipboard (${result.format}).`;
}

export function notifyCopyResult(result: ClipboardResult): void {
  const message = formatCopyMessage(result);
  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeTime: 5000,
  })
    .createLine({
      text: message,
      type: result.ok ? "success" : "fail",
      progress: 100,
    })
    .show();
}
