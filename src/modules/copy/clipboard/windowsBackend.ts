import { writeWindowsFileDrop } from "../windowsFileClipboard";
import { buildFailureResult, buildSuccessResult } from "./backends";
import type { ClipboardBackend } from "./backends";
import { BACKEND_IDS } from "./types";

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
    id: BACKEND_IDS.WINDOWS_NATIVE,
    priority: 100,
    isAvailable: async (payload) => ({
      available: payload.paths.length > 0,
    }),
    write: async (payload) => {
      if (!(await deps.writeWindowsFileDrop?.(payload.paths))) {
        return buildFailureResult(payload);
      }

      return buildSuccessResult(payload, "file-object", "copied-files");
    },
  };
}
