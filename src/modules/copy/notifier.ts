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
