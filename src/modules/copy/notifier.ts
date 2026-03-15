import { config } from "../../../package.json";
import type { ClipboardResult } from "./types";
import {
  formatCopyResultMessage,
  type CopyMessageRenderDeps,
} from "./copyMessages";

export function formatCopyMessage(
  result: ClipboardResult,
  deps: CopyMessageRenderDeps = {},
): string {
  return formatCopyResultMessage(result, deps);
}

export function getCopyNotificationOptions(result: ClipboardResult): {
  closeTime: number;
} {
  return {
    closeTime:
      result.outcome === "copied-path-text-fallback" ||
      (result.ok && result.format === "path-text")
        ? 7000
        : 5000,
  };
}

function getCopyResultNotificationIcon(_result: ClipboardResult): string {
  return `chrome://${config.addonRef}/content/icons/favicon.svg`;
}

export function notifyCopyResult(result: ClipboardResult): void {
  const message = formatCopyMessage(result);
  const icon = getCopyResultNotificationIcon(result);
  const options = getCopyNotificationOptions(result);
  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeTime: options.closeTime,
  })
    .createLine({
      text: message,
      icon,
      progress: 100,
    })
    .show();
}
