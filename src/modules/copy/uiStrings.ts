export interface CopyUILanguageDeps {
  getLanguage?(): string | undefined;
}

export function getCurrentLanguageTag(
  deps: CopyUILanguageDeps = {},
): string | undefined {
  const providedLanguage = deps.getLanguage?.();
  if (providedLanguage) {
    return providedLanguage;
  }

  const servicesLocale = (globalThis as any).Services?.locale?.appLocaleAsBCP47;
  if (typeof servicesLocale === "string" && servicesLocale) {
    return servicesLocale;
  }

  const zoteroLocale = (globalThis as any).Zotero?.locale;
  if (typeof zoteroLocale === "string" && zoteroLocale) {
    return zoteroLocale;
  }

  const navigatorLanguage = (globalThis as any).navigator?.language;
  if (typeof navigatorLanguage === "string" && navigatorLanguage) {
    return navigatorLanguage;
  }

  return undefined;
}

export function isChineseLanguageTag(languageTag: string | undefined): boolean {
  return (languageTag || "").toLowerCase().startsWith("zh");
}

export function localizeKnownCopyMessage(
  message: string | undefined,
  languageTag: string | undefined,
): string | undefined {
  if (!message) {
    return undefined;
  }

  if (!isChineseLanguageTag(languageTag)) {
    return message;
  }

  return CHINESE_COPY_MESSAGES[message] || undefined;
}

const CHINESE_COPY_MESSAGES: Record<string, string> = {
  "No active reader attachment.": "当前没有活动的阅读器附件。",
  "No files to copy.": "没有可复制的文件。",
  "Clipboard write failed.": "写入剪贴板失败。",
  "File clipboard unavailable. Copied file path text instead.":
    "文件剪贴板不可用，已改为复制文件路径文本。",
  "Install wl-clipboard to enable file copy on Wayland.":
    "要在 Wayland 中启用文件复制，请安装 wl-clipboard。",
  "Install python3-gi to enable file copy on X11.":
    "要在 X11 中启用文件复制，请安装 python3-gi。",
  "Install python3-gi and gir1.2-gtk-4.0 to enable Linux file copy.":
    "要在 Linux 中启用文件复制，请安装 python3-gi 和 gir1.2-gtk-4.0。",
  "Install xclip to enable file copy on X11.":
    "要在 X11 中启用文件复制，请安装 xclip。",
  "macOS osascript is required to copy files.":
    "macOS 需要 osascript 才能复制文件。",
};
