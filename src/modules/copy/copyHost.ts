import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./attachmentResolver";
import { writeClipboard } from "./clipboardWriter";
import { getRuntimeSettingsStore } from "./runtime/runtimeSettings";
import { getClipboardDiagnostics } from "./runtimeDiagnostics";
import type { CopyServiceDeps } from "./copyService";
import { getActiveReaderItemID } from "./zoteroReaderAccess";

export function createDefaultCopyServiceDeps(): CopyServiceDeps {
  const runtimeSettings = getRuntimeSettingsStore();

  return {
    getSettings: () => {
      const snapshot = runtimeSettings.getSnapshot();
      return {
        allowedTypes: snapshot.allowedTypes,
        multiAttachmentMode: snapshot.multiAttachmentMode,
      };
    },
    getSelectedItems: () => {
      const pane = Zotero.getActiveZoteroPane();
      return (pane?.getSelectedItems?.() || []) as Zotero.Item[];
    },
    getCurrentReaderItemID: () => getActiveReaderItemID(),
    resolveFromItems: (items, mode, allowedTypes) =>
      resolveAttachmentsFromItems(items, mode, allowedTypes),
    resolveFromReader: (itemID, allowedTypes) =>
      resolveAttachmentFromReader(itemID, allowedTypes),
    writeClipboard: (files, source) => writeClipboard(files, source),
    getClipboardDiagnostics: () => getClipboardDiagnostics(),
  };
}
