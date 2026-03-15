import {
  getAllowedAttachmentTypes,
  getLibraryShortcut,
  getMainToolbarButtonEnabled,
  getMultiAttachmentMode,
  getReaderShortcut,
  getReaderToolbarButtonEnabled,
} from "../../../utils/prefs";
import { parseShortcut, type ParsedShortcut } from "../shortcuts";
import type { MultiAttachmentMode } from "../types";

export interface RuntimeSettingsSnapshot {
  allowedTypes: string[];
  multiAttachmentMode: MultiAttachmentMode;
  libraryShortcut: string;
  readerShortcut: string;
  parsedLibraryShortcut: ParsedShortcut | undefined;
  parsedReaderShortcut: ParsedShortcut | undefined;
  showMainToolbarButton: boolean;
  showReaderToolbarButton: boolean;
}

export interface RuntimeSettingsStore {
  getSnapshot(): RuntimeSettingsSnapshot;
  invalidate(): void;
}

export interface RuntimeSettingsDeps {
  getAllowedTypes(): string[];
  getMultiAttachmentMode(): MultiAttachmentMode;
  getLibraryShortcut(): string;
  getReaderShortcut(): string;
  getMainToolbarButtonEnabled(): boolean;
  getReaderToolbarButtonEnabled(): boolean;
  parseShortcut(value: string | undefined): ParsedShortcut | undefined;
}

const DEFAULT_DEPS: RuntimeSettingsDeps = {
  getAllowedTypes: () => getAllowedAttachmentTypes(),
  getMultiAttachmentMode: () => getMultiAttachmentMode(),
  getLibraryShortcut: () => getLibraryShortcut(),
  getReaderShortcut: () => getReaderShortcut(),
  getMainToolbarButtonEnabled: () => getMainToolbarButtonEnabled(),
  getReaderToolbarButtonEnabled: () => getReaderToolbarButtonEnabled(),
  parseShortcut: (value) => parseShortcut(value),
};

const defaultRuntimeSettingsStore = createRuntimeSettingsStore();

export function createRuntimeSettingsStore(
  deps: RuntimeSettingsDeps = DEFAULT_DEPS,
): RuntimeSettingsStore {
  let snapshot: RuntimeSettingsSnapshot | undefined;

  return {
    getSnapshot(): RuntimeSettingsSnapshot {
      if (!snapshot) {
        const libraryShortcut = deps.getLibraryShortcut();
        const readerShortcut = deps.getReaderShortcut();
        snapshot = {
          allowedTypes: deps.getAllowedTypes(),
          multiAttachmentMode: deps.getMultiAttachmentMode(),
          libraryShortcut,
          readerShortcut,
          parsedLibraryShortcut: deps.parseShortcut(libraryShortcut),
          parsedReaderShortcut: deps.parseShortcut(readerShortcut),
          showMainToolbarButton: deps.getMainToolbarButtonEnabled(),
          showReaderToolbarButton: deps.getReaderToolbarButtonEnabled(),
        };
      }

      return snapshot;
    },

    invalidate(): void {
      snapshot = undefined;
    },
  };
}

export function getRuntimeSettingsStore(): RuntimeSettingsStore {
  return defaultRuntimeSettingsStore;
}
