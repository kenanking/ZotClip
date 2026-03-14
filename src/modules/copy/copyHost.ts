import {
  getAllowedAttachmentTypes,
  getMultiAttachmentMode,
} from "../../utils/prefs";
import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./attachmentResolver";
import { writeClipboard } from "./clipboardWriter";
import { getClipboardDiagnostics } from "./runtimeDiagnostics";
import type { CopyServiceDeps } from "./copyService";

export function createDefaultCopyServiceDeps(): CopyServiceDeps {
  return {
    getSettings: () => ({
      allowedTypes: getAllowedAttachmentTypes(),
      multiAttachmentMode: getMultiAttachmentMode(),
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
