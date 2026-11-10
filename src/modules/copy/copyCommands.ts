import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./attachmentResolver";
import { writeClipboard } from "./clipboardWriter";
import { buildUnavailableResult } from "./copyAvailability";
import { getActiveReaderItemID } from "./zoteroReaderAccess";
import type { ClipboardSource } from "./clipboard/types";
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
    source: ClipboardSource,
  ): Promise<ClipboardResult>;
}

const DEFAULT_DEPS: CopyCommandDeps = {
  getSelectedItems: () => {
    const pane = Zotero.getActiveZoteroPane();
    return (pane?.getSelectedItems?.() || []) as Zotero.Item[];
  },
  getCurrentReaderItemID: getActiveReaderItemID,
  resolveFromItems: resolveAttachmentsFromItems,
  resolveFromReader: resolveAttachmentFromReader,
  writeClipboard,
};

export async function copyFromSelection(
  mode: MultiAttachmentMode = "all",
  allowedTypes: string[],
  deps: CopyCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  const files = await deps.resolveFromItems(
    deps.getSelectedItems(),
    mode,
    allowedTypes,
  );
  return deps.writeClipboard(files, "library");
}

export async function copyFromReader(
  allowedTypes: string[],
  deps: CopyCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  return copyFromReaderItem(undefined, allowedTypes, deps);
}

export async function copyFromReaderItem(
  itemID: number | undefined,
  allowedTypes: string[],
  deps: CopyCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  const activeItemID = itemID ?? deps.getCurrentReaderItemID();
  if (!activeItemID) {
    return buildUnavailableResult("copy-reader-no-active");
  }
  const files = await deps.resolveFromReader(activeItemID, allowedTypes);
  return deps.writeClipboard(files, "reader");
}

export async function copyItems(
  items: Zotero.Item[],
  mode: MultiAttachmentMode,
  allowedTypes: string[],
): Promise<ClipboardResult> {
  return copyFromSelection(mode, allowedTypes, {
    ...DEFAULT_DEPS,
    getSelectedItems: () => items,
  });
}
