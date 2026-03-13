import type { ClipboardResult } from "../types";
import { writeWindowsFileDrop } from "../windowsFileClipboard";
import type { ClipboardBackend } from "./backends";
import type { ClipboardPayload } from "./types";

export interface WindowsBackendDeps {
  writeWindowsFileDrop?(paths: string[]): boolean | Promise<boolean>;
}

const DEFAULT_DEPS: WindowsBackendDeps = {
  writeWindowsFileDrop: (paths) => writeWindowsFileDrop(paths),
};

export function createWindowsBackend(
  deps: WindowsBackendDeps = DEFAULT_DEPS,
): ClipboardBackend {
  return {
    id: "windows-native",
    priority: 100,
    isAvailable: async (payload) => ({
      available: payload.paths.length > 0,
    }),
    write: async (payload) => {
      if (!(await deps.writeWindowsFileDrop?.(payload.paths))) {
        return buildFailureResult(payload);
      }

      return {
        ok: true,
        count: payload.paths.length,
        format: "file-object",
        outcome: "copied-files",
      };
    },
  };
}

function buildFailureResult(payload: ClipboardPayload): ClipboardResult {
  return {
    ok: false,
    count: payload.paths.length,
    format: "none",
    outcome: "copy-failed",
    message: "Clipboard write failed.",
  };
}
