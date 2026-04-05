import { getAddonFaviconUri } from "../../utils/addonAssets";
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

function getCopyResultNotificationIcon(_result: ClipboardResult): string {
  return getAddonFaviconUri();
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
