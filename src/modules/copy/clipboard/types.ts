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

// MIME type constants
export const MIME_TYPES = {
  URI_LIST: "text/uri-list",
  GNOME_COPIED_FILES: "x-special/gnome-copied-files",
} as const;

// Backend ID constants
export const BACKEND_IDS = {
  LINUX_GTK4: "linux-gtk4-helper",
  LINUX_WAYLAND: "linux-wayland-wl-copy-uri-list",
  WINDOWS_NATIVE: "windows-native",
  MACOS_OSASCRIPT: "macos-osascript-file-list",
  PATH_TEXT: "path-text",
  FALLBACK: "generic-clipboard-fallback",
} as const;
