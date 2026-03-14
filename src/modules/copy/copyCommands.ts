import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./attachmentResolver";
import { writeClipboard } from "./clipboardWriter";
import { createCopyService, type CopyServiceDeps } from "./copyService";
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
  return createServiceFromCommandDeps(mode, allowedTypes, deps).copySelection();
}

export async function copyFromReader(
  allowedTypes: string[],
  deps: CopyCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  return createServiceFromCommandDeps("all", allowedTypes, deps).copyReader();
}

export async function copyFromReaderItem(
  itemID: number | undefined,
  allowedTypes: string[],
  deps: CopyCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  return createServiceFromCommandDeps("all", allowedTypes, deps).copyReader(
    itemID,
  );
}

function createServiceFromCommandDeps(
  mode: MultiAttachmentMode,
  allowedTypes: string[],
  deps: CopyCommandDeps,
) {
  const serviceDeps: CopyServiceDeps = {
    getSettings: () => ({
      allowedTypes,
      multiAttachmentMode: mode,
    }),
    getSelectedItems: () => deps.getSelectedItems(),
    getCurrentReaderItemID: () => deps.getCurrentReaderItemID(),
    resolveFromItems: (items, nextMode, nextAllowedTypes) =>
      deps.resolveFromItems(items, nextMode, nextAllowedTypes),
    resolveFromReader: (itemID, nextAllowedTypes) =>
      deps.resolveFromReader(itemID, nextAllowedTypes),
    writeClipboard: (files, source) => deps.writeClipboard(files, source),
    getClipboardDiagnostics: async () => ({
      platform: "linux",
      linuxSession: "unknown",
      commands: {},
      activeBackend: "unknown",
      lines: [],
    }),
  };

  return createCopyService(serviceDeps);
}
