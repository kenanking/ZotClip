import { config } from "../../../package.json";
import type { ClipboardResult } from "./types";
import {
  getCurrentLanguageTag,
  isChineseLanguageTag,
  localizeKnownCopyMessage,
  type CopyUILanguageDeps,
} from "./uiStrings";

export function formatCopyMessage(
  result: ClipboardResult,
  deps: CopyUILanguageDeps = {},
): string {
  const languageTag = getCurrentLanguageTag(deps);
  const isChinese = isChineseLanguageTag(languageTag);
  const localizedMessage = localizeKnownCopyMessage(
    result.message,
    languageTag,
  );

  if (
    (result.outcome === "backend-unavailable" ||
      result.outcome === "dependency-missing") &&
    localizedMessage
  ) {
    return localizedMessage;
  }

  if (result.outcome === "copied-files") {
    if (result.format !== "file-object") {
      return isChinese
        ? `已复制 ${result.count} 个附件文件到剪贴板。`
        : `Copied ${result.count} attachment file(s) to clipboard.`;
    }

    return isChinese
      ? `已复制 ${result.count} 个附件文件到剪贴板（文件对象）。`
      : `Copied ${result.count} attachment file(s) to clipboard (file-object).`;
  }

  if (result.outcome === "copied-file-uris") {
    return isChinese
      ? `已复制 ${result.count} 个附件文件 URI 到剪贴板。`
      : `Copied ${result.count} attachment file URI(s) to clipboard.`;
  }

  if (result.outcome === "copied-path-text-fallback") {
    if (localizedMessage) {
      return localizedMessage;
    }

    return isChinese
      ? `附件文件复制失败，已改为复制 ${result.count} 个附件路径。`
      : `Attachment file copy failed. Copied ${result.count} attachment path(s) instead.`;
  }

  if (localizedMessage && !result.ok) {
    return localizedMessage;
  }

  if (!result.ok) {
    return isChinese
      ? "复制失败。请检查文件是否可用，以及目标应用是否支持当前剪贴板格式。"
      : "Copy failed. Please check file availability and clipboard support in target app.";
  }

  if (result.format === "path-text") {
    return isChinese
      ? `附件文件复制失败，已改为复制 ${result.count} 个附件路径。`
      : `Attachment file copy failed. Copied ${result.count} attachment path(s) instead.`;
  }

  return isChinese
    ? `已复制 ${result.count} 个附件文件到剪贴板（${result.format}）。`
    : `Copied ${result.count} attachment file(s) to clipboard (${result.format}).`;
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
