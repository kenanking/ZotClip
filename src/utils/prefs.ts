import { config } from "../../package.json";
import { normalizeExtensionList } from "../modules/copy/attachmentTypes";
import type { MultiAttachmentMode } from "../modules/copy/types";
import type { ReaderCtrlCMode } from "../modules/copy/readerHook";

type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];

const PREFS_PREFIX = config.prefsPrefix;

/**
 * Get preference value.
 * Wrapper of `Zotero.Prefs.get`.
 * @param key
 */
export function getPref<K extends keyof PluginPrefsMap>(key: K) {
  return Zotero.Prefs.get(`${PREFS_PREFIX}.${key}`, true) as PluginPrefsMap[K];
}

/**
 * Set preference value.
 * Wrapper of `Zotero.Prefs.set`.
 * @param key
 * @param value
 */
export function setPref<K extends keyof PluginPrefsMap>(
  key: K,
  value: PluginPrefsMap[K],
) {
  return Zotero.Prefs.set(`${PREFS_PREFIX}.${key}`, value, true);
}

/**
 * Clear preference value.
 * Wrapper of `Zotero.Prefs.clear`.
 * @param key
 */
export function clearPref(key: string) {
  return Zotero.Prefs.clear(`${PREFS_PREFIX}.${key}`, true);
}

export function getMultiAttachmentMode(): MultiAttachmentMode {
  const value = getPref("multiAttachmentMode");
  return value === "primary" ? "primary" : "all";
}

export function getReaderCtrlCMode(): ReaderCtrlCMode {
  const value = getPref("readerCtrlCMode");
  if (value === "always" || value === "never") {
    return value;
  }
  return "smart";
}

export function getLibraryShortcut(): string {
  return (getPref("libraryShortcut") || "Ctrl+C").trim();
}

export function getReaderShortcut(): string {
  return (getPref("readerShortcut") || "").trim();
}

export function migrateLegacyShortcutPrefs(input: {
  readerCtrlCMode?: string;
  readerShortcut?: string;
}): {
  readerShortcut: string;
} {
  const existingShortcut = input.readerShortcut?.trim() || "";
  if (existingShortcut) {
    return {
      readerShortcut: existingShortcut,
    };
  }

  return {
    readerShortcut: input.readerCtrlCMode === "always" ? "Ctrl+Shift+C" : "",
  };
}

export function migrateShortcutPrefs(): void {
  const legacyMode = getPref("readerCtrlCMode");
  const currentReaderShortcut = getPref("readerShortcut") || "";
  const migratedPrefs = migrateLegacyShortcutPrefs({
    readerCtrlCMode: legacyMode,
    readerShortcut: currentReaderShortcut,
  });

  if (migratedPrefs.readerShortcut !== currentReaderShortcut) {
    setPref("readerShortcut", migratedPrefs.readerShortcut);
  }
}

export function getEnabledAttachmentTypes(): string[] {
  return normalizeExtensionList(getPref("enabledAttachmentTypes") || "");
}

export function getCustomAttachmentTypes(): string[] {
  return normalizeExtensionList(getPref("customAttachmentTypes") || "");
}

export function getAllowedAttachmentTypes(): string[] {
  return normalizeExtensionList([
    ...getEnabledAttachmentTypes(),
    ...getCustomAttachmentTypes(),
  ]);
}
