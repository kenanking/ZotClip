import type { ClipboardBackend } from "./backends";

export interface PathTextBackendDeps {
  writePathText?(value: string): boolean;
}

const DEFAULT_DEPS: PathTextBackendDeps = {
  writePathText: (value) => {
    Zotero.Utilities.Internal.copyTextToClipboard(value);
    return true;
  },
};

export function createPathTextBackend(
  deps: PathTextBackendDeps = DEFAULT_DEPS,
): ClipboardBackend {
  return {
    id: "path-text",
    priority: 0,
    isAvailable: async (payload) => ({
      available: payload.pathText.length > 0,
    }),
    write: async (payload) => {
      if (!deps.writePathText?.(payload.pathText)) {
        return {
          ok: false,
          count: payload.paths.length,
          format: "none",
          outcome: "copy-failed",
          message: "Clipboard write failed.",
        };
      }

      return {
        ok: true,
        count: payload.paths.length,
        format: "path-text",
        outcome: "copied-path-text-fallback",
        message: "File clipboard unavailable. Copied file path text instead.",
      };
    },
  };
}
