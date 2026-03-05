import {
  resolvePDFFromReader,
  resolvePDFsFromItems,
} from "./attachmentResolver";
import { writeClipboard } from "./clipboardWriter";
import type { ClipboardResult, MultiPDFMode, ResolvedPDF } from "./types";

export interface CopyCommandDeps {
  getSelectedItems(): Zotero.Item[];
  getCurrentReaderItemID(): number | undefined;
  resolveFromItems(
    items: Zotero.Item[],
    mode: MultiPDFMode,
  ): Promise<ResolvedPDF[]>;
  resolveFromReader(itemID: number): Promise<ResolvedPDF[]>;
  writeClipboard(
    files: ResolvedPDF[],
    allowPathFallback: boolean,
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
  resolveFromItems: (items, mode) => resolvePDFsFromItems(items, mode),
  resolveFromReader: (itemID) => resolvePDFFromReader(itemID),
  writeClipboard: (files, allowPathFallback) =>
    writeClipboard(files, allowPathFallback),
};

export async function copyFromSelection(
  mode: MultiPDFMode = "all",
  allowPathFallback = true,
  deps: CopyCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  const selectedItems = deps.getSelectedItems();
  const files = await deps.resolveFromItems(selectedItems, mode);
  return deps.writeClipboard(files, allowPathFallback);
}

export async function copyFromReader(
  allowPathFallback = true,
  deps: CopyCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  const readerItemID = deps.getCurrentReaderItemID();
  if (!readerItemID) {
    return {
      ok: false,
      format: "none",
      count: 0,
      message: "No active reader attachment.",
    };
  }

  const files = await deps.resolveFromReader(readerItemID);
  return deps.writeClipboard(files, allowPathFallback);
}
