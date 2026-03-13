export type ClipboardSource = "library" | "reader";

export interface ClipboardPayload {
  paths: string[];
  fileUris: string[];
  pathText: string;
  operation: "copy";
  source: ClipboardSource;
}

export interface BackendAvailability {
  available: boolean;
  reason?: string;
  dependency?: string;
}
