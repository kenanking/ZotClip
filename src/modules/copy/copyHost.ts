import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./attachmentResolver";
import { writeClipboard } from "./clipboardWriter";
import { getRuntimeSettingsStore } from "./runtime/runtimeSettings";
import { getClipboardDiagnostics } from "./runtimeDiagnostics";
import type { CopyServiceDeps } from "./copyService";

export function createDefaultCopyServiceDeps(): CopyServiceDeps {
  const runtimeSettings = getRuntimeSettingsStore();

  return {
    getSettings: () => ({
      allowedTypes: runtimeSettings.getSnapshot().allowedTypes,
      multiAttachmentMode: runtimeSettings.getSnapshot().multiAttachmentMode,
    }),
    getSelectedItems: () => {
      const pane = Zotero.getActiveZoteroPane();
      return (pane?.getSelectedItems?.() || []) as Zotero.Item[];
    },
    getCurrentReaderItemID: () => {
      const tabs = ztoolkit.getGlobal("Zotero_Tabs") as {
        selectedID?: string;
      };
      const selectedTabID = tabs?.selectedID;
      if (!selectedTabID) {
        return undefined;
      }

      return Zotero.Reader.getByTabID(selectedTabID)?.itemID;
    },
    resolveFromItems: (items, mode, allowedTypes) =>
      resolveAttachmentsFromItems(items, mode, allowedTypes),
    resolveFromReader: (itemID, allowedTypes) =>
      resolveAttachmentFromReader(itemID, allowedTypes),
    writeClipboard: (files, source) => writeClipboard(files, source),
    getClipboardDiagnostics: () => getClipboardDiagnostics(),
  };
}
