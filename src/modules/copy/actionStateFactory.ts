import { copyFromReaderItem, copyFromSelection } from "./copyCommands";
import {
  buildUnavailableResult,
  checkReaderAvailability,
  checkSelectionAvailability,
} from "./copyService";
import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./attachmentResolver";
import { createCopyActionController } from "./interaction/actions/copyActionController";
import type { CopyActionState } from "./interaction/actions/copyActionTypes";
import { getSelectedLibraryItems } from "./interaction/context/libraryContext";
import { getActiveReaderItemID } from "./zoteroReaderAccess";
import { notifyCopyResult } from "./notifier";
import type { RuntimeSettingsSnapshot } from "./runtime/runtimeSettings";
import type {
  MainToolbarCopyButtonDeps,
  ReaderToolbarCopyButtonDeps,
} from "./toolbarButtonDeps";

export async function createActiveLibraryActionState(
  settings: RuntimeSettingsSnapshot,
): Promise<CopyActionState> {
  const getItems = () =>
    getSelectedLibraryItems({
      getActivePane: () => Zotero.getActiveZoteroPane(),
    });

  const controller = createCopyActionController({
    getAllowedTypes: () => settings.allowedTypes,
    getMode: () => settings.multiAttachmentMode,
    getLibraryItems: getItems,
    getReaderItemID: () => undefined,
    getSelectionAvailability: () =>
      checkSelectionAvailability(
        settings,
        getItems(),
        resolveAttachmentsFromItems,
      ),
    getReaderAvailability: async () => ({
      canCopy: false,
      messageKey: "copy-reader-no-active",
    }),
    executePrimaryLibraryCopy: async () => {
      const result = await copyFromSelection(
        settings.multiAttachmentMode,
        settings.allowedTypes,
      );
      notifyCopyResult(result);
      return result;
    },
    executePrimaryReaderCopy: async () =>
      buildUnavailableResult("copy-reader-no-active"),
  });

  return controller.getCurrentActionState();
}

export async function createMainToolbarActionState(
  win: Window,
  deps: MainToolbarCopyButtonDeps,
): Promise<CopyActionState> {
  const controller = createCopyActionController({
    getAllowedTypes: () => deps.getAllowedTypes(),
    getMode: () => deps.getMode(),
    getLibraryItems: () => deps.getSelectedItems(win),
    getReaderItemID: () => undefined,
    getSelectionAvailability: () =>
      checkSelectionAvailability(
        {
          allowedTypes: deps.getAllowedTypes(),
          multiAttachmentMode: deps.getMode(),
        },
        deps.getSelectedItems(win),
        deps.resolveFromItems,
      ),
    getReaderAvailability: async () => ({
      canCopy: false,
      messageKey: "copy-reader-no-active",
    }),
    executePrimaryLibraryCopy: async () => deps.executeCopy(),
    executePrimaryReaderCopy: async () =>
      buildUnavailableResult("copy-reader-no-active"),
  });

  return controller.getCurrentActionState();
}

export async function createActiveReaderActionState(
  settings: RuntimeSettingsSnapshot,
): Promise<CopyActionState> {
  const itemID = getActiveReaderItemID();

  const controller = createCopyActionController({
    getAllowedTypes: () => settings.allowedTypes,
    getMode: () => settings.multiAttachmentMode,
    getLibraryItems: () => [],
    getReaderItemID: () => itemID,
    getSelectionAvailability: async () => ({
      canCopy: false,
      messageKey: "copy-no-files",
    }),
    getReaderAvailability: () =>
      checkReaderAvailability(
        itemID,
        settings.allowedTypes,
        resolveAttachmentFromReader,
      ),
    executePrimaryLibraryCopy: async () =>
      buildUnavailableResult("copy-no-files"),
    executePrimaryReaderCopy: async () => {
      const result = await copyFromReaderItem(itemID, settings.allowedTypes);
      notifyCopyResult(result);
      return result;
    },
  });

  return controller.getCurrentActionState();
}

export async function createReaderToolbarActionState(
  itemID: number | undefined,
  deps: ReaderToolbarCopyButtonDeps,
): Promise<CopyActionState> {
  const controller = createCopyActionController({
    getAllowedTypes: () => deps.getAllowedTypes(),
    getMode: () => "all",
    getLibraryItems: () => [],
    getReaderItemID: () => itemID,
    getSelectionAvailability: async () => ({
      canCopy: false,
      messageKey: "copy-no-files",
    }),
    getReaderAvailability: () =>
      checkReaderAvailability(
        itemID,
        deps.getAllowedTypes(),
        deps.resolveFromReader,
      ),
    executePrimaryLibraryCopy: async () =>
      buildUnavailableResult("copy-no-files"),
    executePrimaryReaderCopy: async () => deps.executeCopy(itemID),
  });

  return controller.getCurrentActionState();
}
