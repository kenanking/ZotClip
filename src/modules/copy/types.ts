export type ClipboardFormat = "file-object" | "uri-list" | "path-text" | "none";

export type MultiAttachmentMode = "all" | "primary";

export interface ResolvedAttachment {
  itemID: number;
  attachmentID: number;
  path: string;
}

export interface ClipboardResult {
  ok: boolean;
  format: ClipboardFormat;
  count: number;
  message?: string;
}
