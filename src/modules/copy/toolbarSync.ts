import type { RuntimeSettingsStore } from "./runtime/runtimeSettings";
import { config } from "../../../package.json";

const RUNTIME_SETTINGS_PREF_KEYS = [
  "multiAttachmentMode",
  "libraryShortcut",
  "readerShortcut",
  "showMainToolbarButton",
  "showReaderToolbarButton",
  "enabledAttachmentTypes",
  "customAttachmentTypes",
] as const;

export function registerToolbarPreferenceObservers(
  runtimeSettings: RuntimeSettingsStore,
  syncMainToolbarButtons: () => void,
  syncReaderToolbarButton: () => void,
): symbol[] {
  return RUNTIME_SETTINGS_PREF_KEYS.map((key) =>
    Zotero.Prefs.registerObserver(
      `${config.prefsPrefix}.${key}`,
      () => {
        runtimeSettings.invalidate();
        syncMainToolbarButtons();
        syncReaderToolbarButton();
      },
      true,
    ),
  );
}

export function unregisterToolbarPreferenceObservers(
  observers: symbol[],
): void {
  for (const observer of observers) {
    Zotero.Prefs.unregisterObserver(observer);
  }
}
