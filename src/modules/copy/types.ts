export const CLIPBOARD_FORMATS = [
  "file-object",
  "uri-list",
  "path-text",
  "none",
] as const;

export const RESOLVE_ERRORS = [
  "RESOLVE_EMPTY",
  "RESOLVE_PARTIAL",
  "CLIPBOARD_FILE_FAILED",
  "CLIPBOARD_FALLBACK_USED",
  "CLIPBOARD_ALL_FAILED",
] as const;

export type ClipboardFormat = (typeof CLIPBOARD_FORMATS)[number];
export type ResolveErrorCode = (typeof RESOLVE_ERRORS)[number];

export type MultiAttachmentMode = "all" | "primary";
export type MultiPDFMode = MultiAttachmentMode;

export interface ResolvedAttachment {
  itemID: number;
  attachmentID: number;
  path: string;
}
export type ResolvedPDF = ResolvedAttachment;

export interface ClipboardResult {
  ok: boolean;
  format: ClipboardFormat;
  count: number;
  fallbackUsed?: boolean;
  message?: string;
}
