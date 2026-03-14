import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./attachmentResolver";
import { writeClipboard } from "./clipboardWriter";
import type {
  ClipboardResult,
  MultiAttachmentMode,
  ResolvedAttachment,
} from "./types";

export interface CopyCommandDeps {
  getSelectedItems(): Zotero.Item[];
  getCurrentReaderItemID(): number | undefined;
  resolveFromItems(
    items: Zotero.Item[],
    mode: MultiAttachmentMode,
    allowedTypes: string[],
  ): Promise<ResolvedAttachment[]>;
  resolveFromReader(
    itemID: number,
    allowedTypes: string[],
  ): Promise<ResolvedAttachment[]>;
  writeClipboard(
    files: ResolvedAttachment[],
    source: "library" | "reader",
  ): Promise<ClipboardResult>;
}

const DEFAULT_DEPS: CopyCommandDeps = {
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
};

export async function copyFromSelection(
  mode: MultiAttachmentMode = "all",
  allowedTypes: string[],
  deps: CopyCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  const selectedItems = deps.getSelectedItems();
  const files = await deps.resolveFromItems(selectedItems, mode, allowedTypes);
  return deps.writeClipboard(files, "library");
}

export async function copyFromReader(
  allowedTypes: string[],
  deps: CopyCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  return copyFromReaderItem(deps.getCurrentReaderItemID(), allowedTypes, deps);
}

export async function copyFromReaderItem(
  itemID: number | undefined,
  allowedTypes: string[],
  deps: CopyCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  if (!itemID) {
    return {
      ok: false,
      format: "none",
      count: 0,
      messageKey: "copy-reader-no-active",
    };
  }

  const files = await deps.resolveFromReader(itemID, allowedTypes);
  return deps.writeClipboard(files, "reader");
}
