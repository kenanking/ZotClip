export type ClipboardFormat =
  | "file-object"
  | "file-uri-list"
  | "path-text"
  | "none";

export type ClipboardOutcome =
  | "copied-files"
  | "copied-path-text-fallback"
  | "backend-unavailable"
  | "dependency-missing"
  | "copy-failed";

export type CopyMessageKey =
  | "copy-no-files"
  | "copy-no-file-uris"
  | "copy-reader-no-active"
  | "copy-clipboard-write-failed"
  | "copy-path-text-fallback"
  | "copy-linux-gtk4-missing"
  | "copy-linux-wl-copy-missing"
  | "copy-macos-osascript-missing";

export type CopyMessageArgs = Record<string, string | number>;

export type MultiAttachmentMode = "all" | "primary";

export interface ResolvedAttachment {
  itemID: number;
  attachmentID: number;
  path: string;
  clipboardPath?: string;
}

export interface ClipboardResult {
  ok: boolean;
  format: ClipboardFormat;
  count: number;
  outcome?: ClipboardOutcome;
  messageKey?: CopyMessageKey;
  messageArgs?: CopyMessageArgs;
}
