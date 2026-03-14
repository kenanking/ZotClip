import type { ClipboardDiagnostics } from "./clipboard/diagnostics";
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
    source: "library" | "reader",
  ): Promise<ClipboardResult>;
  getClipboardDiagnostics(): Promise<ClipboardDiagnostics>;
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
        return buildNoActiveReaderResult();
      }

      const settings = deps.getSettings();
      const files = await deps.resolveFromReader(
        activeItemID,
        settings.allowedTypes,
      );
      return deps.writeClipboard(files, "reader");
    },

    async getSelectionAvailability(): Promise<CopyAvailability> {
      const settings = deps.getSettings();
      const files = await deps.resolveFromItems(
        deps.getSelectedItems(),
        settings.multiAttachmentMode,
        settings.allowedTypes,
      );

      return files.length
        ? { canCopy: true }
        : {
            canCopy: false,
            messageKey: "copy-no-files",
          };
    },

    async getReaderAvailability(itemID?: number): Promise<CopyAvailability> {
      const activeItemID = itemID ?? deps.getCurrentReaderItemID();
      if (!activeItemID) {
        return {
          canCopy: false,
          messageKey: "copy-reader-no-active",
        };
      }

      const settings = deps.getSettings();
      const files = await deps.resolveFromReader(
        activeItemID,
        settings.allowedTypes,
      );

      return files.length
        ? { canCopy: true }
        : {
            canCopy: false,
            messageKey: "copy-no-files",
          };
    },

    getClipboardDiagnostics(): Promise<ClipboardDiagnostics> {
      return deps.getClipboardDiagnostics();
    },
  };
}

function buildNoActiveReaderResult(): ClipboardResult {
  return {
    ok: false,
    format: "none",
    count: 0,
    messageKey: "copy-reader-no-active",
  };
}
