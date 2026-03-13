import { runClipboardBackends } from "./clipboard/backendRegistry";
import type { ClipboardBackend } from "./clipboard/backends";
import { createPathTextBackend } from "./clipboard/pathTextBackend";
import { buildClipboardPayload } from "./clipboard/payload";
import {
  detectCurrentPlatformContext,
  type PlatformContext,
} from "./clipboard/platformDetection";
import { createWindowsBackend } from "./clipboard/windowsBackend";
import type { ClipboardResult, ResolvedAttachment } from "./types";
import { writeWindowsFileDrop } from "./windowsFileClipboard";

export interface ClipboardWriterDeps {
  detectPlatformContext?(): PlatformContext;
  writeWindowsFileDrop?(paths: string[]): Promise<boolean> | boolean;
  writeFileObject(paths: string[]): Promise<boolean>;
  writeURIList(fileUris: string[]): Promise<boolean>;
  writePathText(value: string): boolean;
}

const DEFAULT_DEPS: ClipboardWriterDeps = {
  detectPlatformContext: () => detectCurrentPlatformContext(),
  writeWindowsFileDrop: async (paths) => writeWindowsFileDrop(paths),
  writeFileObject: async (paths) => {
    if (!paths.length) {
      return false;
    }

    // ztoolkit ClipboardHelper stores only one x-moz-file payload.
    // Multi-file callers must try another clipboard format.
    if (paths.length > 1) {
      return false;
    }

    try {
      new ztoolkit.Clipboard().addFile(paths[0]).copy();
      return true;
    } catch (error) {
      ztoolkit.log("writeFileObject failed", error);
      return false;
    }
  },
  writeURIList: async (fileUris) => {
    if (!fileUris.length) {
      return false;
    }

    try {
      const payload = `${fileUris.join("\r\n")}\r\n`;
      const supportsString = getXPCOMClasses()[
        "@mozilla.org/supports-string;1"
      ].createInstance(Components.interfaces.nsISupportsString);
      supportsString.data = payload;

      const transferable = getXPCOMClasses()[
        "@mozilla.org/widget/transferable;1"
      ].createInstance(Components.interfaces.nsITransferable);
      transferable.init(null);
      transferable.addDataFlavor("text/uri-list");
      transferable.setTransferData(
        "text/uri-list",
        supportsString,
        payload.length * 2,
      );

      const clipboardService = getXPCOMClasses()[
        "@mozilla.org/widget/clipboard;1"
      ].getService(Components.interfaces.nsIClipboard);
      clipboardService.setData(
        transferable,
        null,
        Components.interfaces.nsIClipboard.kGlobalClipboard,
      );
      return true;
    } catch (error) {
      ztoolkit.log("writeURIList failed", error);
      return false;
    }
  },
  writePathText: (value) => {
    if (!value) {
      return false;
    }

    try {
      Zotero.Utilities.Internal.copyTextToClipboard(value);
      return true;
    } catch (error) {
      ztoolkit.log("writePathText failed", error);
      return false;
    }
  },
};

export async function writeClipboard(
  files: ResolvedAttachment[],
  source: "library" | "reader" = "library",
  deps: ClipboardWriterDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  const payload = buildClipboardPayload(files, source);
  if (!payload.paths.length) {
    return {
      ok: false,
      format: "none",
      count: 0,
      outcome: "backend-unavailable",
      message: "No files to copy.",
    };
  }

  const platformContext = deps.detectPlatformContext?.() || {
    platform: "linux" as const,
    linuxSession: "unknown" as const,
  };

  const backends =
    platformContext.platform === "windows"
      ? buildWindowsBackends(deps)
      : buildGenericBackends(deps);

  return runClipboardBackends({
    payload,
    backends,
  });
}

function buildWindowsBackends(deps: ClipboardWriterDeps): ClipboardBackend[] {
  return [
    createWindowsBackend({
      writeWindowsFileDrop: async (paths) =>
        !!(await deps.writeWindowsFileDrop?.(paths)),
    }),
    createPathTextBackend({
      writePathText: (value) => deps.writePathText(value),
    }),
  ];
}

function buildGenericBackends(deps: ClipboardWriterDeps): ClipboardBackend[] {
  return [
    {
      id: "generic-file-object",
      priority: 50,
      isAvailable: async (payload) => ({
        available: payload.paths.length === 1,
      }),
      write: async (payload) => {
        if (!(await deps.writeFileObject(payload.paths))) {
          return buildFailureResult(payload.paths.length);
        }

        return {
          ok: true,
          count: payload.paths.length,
          format: "file-object",
          outcome: "copied-files",
        };
      },
    },
    {
      id: "generic-uri-list",
      priority: 40,
      isAvailable: async (payload) => ({
        available: payload.fileUris.length > 0,
      }),
      write: async (payload) => {
        if (!(await deps.writeURIList(payload.fileUris))) {
          return buildFailureResult(payload.paths.length);
        }

        return {
          ok: true,
          count: payload.paths.length,
          format: "file-uri-list",
          outcome: "copied-file-uris",
        };
      },
    },
    createPathTextBackend({
      writePathText: (value) => deps.writePathText(value),
    }),
  ];
}

function buildFailureResult(count: number): ClipboardResult {
  return {
    ok: false,
    count,
    format: "none",
    outcome: "copy-failed",
    message: "Clipboard write failed.",
  };
}

function getXPCOMClasses(): any {
  return Components.classes as any;
}
