import type { ClipboardResult, ResolvedPDF } from "./types";

export interface ClipboardWriterDeps {
  isWindows?(): boolean;
  writeFileObject(paths: string[]): Promise<boolean>;
  writeURIList(paths: string[]): Promise<boolean>;
  writePathText(paths: string[]): boolean;
}

const DEFAULT_DEPS: ClipboardWriterDeps = {
  isWindows: () => Zotero.isWin,
  writeFileObject: async (paths) => {
    if (!paths.length) {
      return false;
    }

    // ztoolkit ClipboardHelper stores only one x-moz-file payload.
    // For multi-file copy we fall through to URI list fallback.
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
  writeURIList: async (paths) => {
    if (!paths.length) {
      return false;
    }

    try {
      const payload = paths.map((path) => pathToFileURI(path)).join("\r\n");
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
  writePathText: (paths) => {
    if (!paths.length) {
      return false;
    }

    try {
      Zotero.Utilities.Internal.copyTextToClipboard(paths.join("\n"));
      return true;
    } catch (error) {
      ztoolkit.log("writePathText failed", error);
      return false;
    }
  },
};

export async function writeClipboard(
  files: ResolvedPDF[],
  allowPathFallback: boolean,
  deps: ClipboardWriterDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  const paths = uniqueNonEmptyPaths(files);
  if (!paths.length) {
    return {
      ok: false,
      format: "none",
      count: 0,
      message: "No files to copy.",
    };
  }

  // Zotero does not expose a reliable Windows file clipboard write here,
  // so prefer deterministic path fallback over a silent no-op.
  if (deps.isWindows?.()) {
    if (allowPathFallback && deps.writePathText(paths)) {
      return {
        ok: true,
        format: "path-text",
        count: paths.length,
        message: "File clipboard unavailable. Copied file path text instead.",
      };
    }

    return {
      ok: false,
      format: "none",
      count: paths.length,
      message:
        "Windows file clipboard is unavailable in Zotero; enable path fallback to copy file paths instead.",
    };
  }

  if (await deps.writeFileObject(paths)) {
    return {
      ok: true,
      format: "file-object",
      count: paths.length,
    };
  }

  if (await deps.writeURIList(paths)) {
    return {
      ok: true,
      format: "uri-list",
      count: paths.length,
    };
  }

  if (allowPathFallback && deps.writePathText(paths)) {
    return {
      ok: true,
      format: "path-text",
      count: paths.length,
      message: "File clipboard unavailable. Copied file path text instead.",
    };
  }

  return {
    ok: false,
    format: "none",
    count: paths.length,
    message: "Clipboard write failed.",
  };
}

function uniqueNonEmptyPaths(files: ResolvedPDF[]): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];

  for (const file of files) {
    const path = file.path?.trim();
    if (!path || seen.has(path)) {
      continue;
    }

    seen.add(path);
    paths.push(path);
  }

  return paths;
}

function pathToFileURI(path: string): string {
  const file = getXPCOMClasses()["@mozilla.org/file/local;1"].createInstance(
    Components.interfaces.nsIFile,
  );
  file.initWithPath(path);
  return Services.io.newFileURI(file).spec;
}

function getXPCOMClasses(): any {
  return Components.classes as any;
}
