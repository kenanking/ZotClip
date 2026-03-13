export type ClipboardFormat =
  | "file-object"
  | "uri-list"
  | "file-uri-list"
  | "path-text"
  | "none";

export type ClipboardOutcome =
  | "copied-files"
  | "copied-file-uris"
  | "copied-path-text-fallback"
  | "backend-unavailable"
  | "dependency-missing"
  | "copy-failed";

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
  outcome?: ClipboardOutcome;
  message?: string;
}
