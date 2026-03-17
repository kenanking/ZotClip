import type { ClipboardDiagnostics } from "./clipboard/diagnostics";
import type { ClipboardSource } from "./clipboard/types";
import type {
  ClipboardResult,
  CopyMessageKey,
  MultiAttachmentMode,
  ResolvedAttachment,
} from "./types";

export interface CopySettings {
  allowedTypes: string[];
  multiAttachmentMode: MultiAttachmentMode;
}

export interface CopyAvailability {
  canCopy: boolean;
  messageKey?: CopyMessageKey;
}

export interface CopyServiceDeps {
  getSettings(): CopySettings;
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
  getClipboardDiagnostics(): Promise<ClipboardDiagnostics>;
}

export async function checkSelectionAvailability(
  settings: CopySettings,
  items: Zotero.Item[],
  resolveFromItems: (
    items: Zotero.Item[],
    mode: MultiAttachmentMode,
    allowedTypes: string[],
  ) => Promise<ResolvedAttachment[]>,
): Promise<CopyAvailability> {
  const files = await resolveFromItems(
    items,
    settings.multiAttachmentMode,
    settings.allowedTypes,
  );
  return files.length
    ? { canCopy: true }
    : { canCopy: false, messageKey: "copy-no-files" };
}

export async function checkReaderAvailability(
  itemID: number | undefined,
  allowedTypes: string[],
  resolveFromReader: (
    itemID: number,
    allowedTypes: string[],
  ) => Promise<ResolvedAttachment[]>,
): Promise<CopyAvailability> {
  if (!itemID) {
    return { canCopy: false, messageKey: "copy-reader-no-active" };
  }
  const files = await resolveFromReader(itemID, allowedTypes);
  return files.length
    ? { canCopy: true }
    : { canCopy: false, messageKey: "copy-no-files" };
}

export interface CopyService {
  copySelection(): Promise<ClipboardResult>;
  copyReader(itemID?: number): Promise<ClipboardResult>;
  getSelectionAvailability(): Promise<CopyAvailability>;
  getReaderAvailability(itemID?: number): Promise<CopyAvailability>;
  getClipboardDiagnostics(): Promise<ClipboardDiagnostics>;
}

export function createCopyService(deps: CopyServiceDeps): CopyService {
  return {
    async copySelection(): Promise<ClipboardResult> {
      const settings = deps.getSettings();
      const files = await deps.resolveFromItems(
        deps.getSelectedItems(),
        settings.multiAttachmentMode,
        settings.allowedTypes,
      );
      return deps.writeClipboard(files, "library");
    },

    async copyReader(itemID?: number): Promise<ClipboardResult> {
      const activeItemID = itemID ?? deps.getCurrentReaderItemID();
      if (!activeItemID) {
        return buildUnavailableResult("copy-reader-no-active");
      }

      const settings = deps.getSettings();
      const files = await deps.resolveFromReader(
        activeItemID,
        settings.allowedTypes,
      );
      return deps.writeClipboard(files, "reader");
    },

    getSelectionAvailability(): Promise<CopyAvailability> {
      const settings = deps.getSettings();
      return checkSelectionAvailability(
        settings,
        deps.getSelectedItems(),
        deps.resolveFromItems,
      );
    },

    getReaderAvailability(itemID?: number): Promise<CopyAvailability> {
      const activeItemID = itemID ?? deps.getCurrentReaderItemID();
      const settings = deps.getSettings();
      return checkReaderAvailability(
        activeItemID,
        settings.allowedTypes,
        deps.resolveFromReader,
      );
    },

    getClipboardDiagnostics(): Promise<ClipboardDiagnostics> {
      return deps.getClipboardDiagnostics();
    },
  };
}

export function buildUnavailableResult(
  messageKey: CopyMessageKey,
): ClipboardResult {
  return { ok: false, format: "none", count: 0, messageKey };
}
