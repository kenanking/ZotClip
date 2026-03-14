import { buildFailureResult, buildSuccessResult } from "./backends";
import type { ClipboardBackend } from "./backends";
import { BACKEND_IDS } from "./types";

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
    id: BACKEND_IDS.PATH_TEXT,
    priority: 0,
    isAvailable: async (payload) => ({
      available: payload.pathText.length > 0,
    }),
    write: async (payload) => {
      if (!deps.writePathText?.(payload.pathText)) {
        return buildFailureResult(payload);
      }

      return {
        ...buildSuccessResult(
          payload,
          "path-text",
          "copied-path-text-fallback",
        ),
        message: "File clipboard unavailable. Copied file path text instead.",
      };
    },
  };
}
