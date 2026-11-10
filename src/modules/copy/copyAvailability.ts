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

export function buildUnavailableResult(
  messageKey: CopyMessageKey,
): ClipboardResult {
  return { ok: false, format: "none", count: 0, messageKey };
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
