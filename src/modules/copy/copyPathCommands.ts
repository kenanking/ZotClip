import { resolveAttachmentFromReader } from "./attachmentResolver";
import { getCurrentReaderItemID } from "./interaction/readerContext";
import type { ClipboardResult, ResolvedAttachment } from "./types";

export interface CopyPathCommandDeps {
  getCurrentReaderItemID(): number | undefined;
  resolveFromReader(
    itemID: number,
    allowedTypes: string[],
  ): Promise<ResolvedAttachment[]>;
  writePathText(value: string): boolean;
}

const DEFAULT_DEPS: CopyPathCommandDeps = {
  getCurrentReaderItemID: () => {
    return getCurrentReaderItemID({
      getTabs: () =>
        ztoolkit.getGlobal("Zotero_Tabs") as
          | {
              selectedID?: string;
              selectedType?: string;
            }
          | undefined,
      getReaderByTabID: (tabID) => Zotero.Reader.getByTabID(tabID),
    });
  },
  resolveFromReader: (itemID, allowedTypes) =>
    resolveAttachmentFromReader(itemID, allowedTypes),
  writePathText: (value) => {
    if (!value) {
      return false;
    }

    try {
      Zotero.Utilities.Internal.copyTextToClipboard(value);
      return true;
    } catch {
      return false;
    }
  },
};

export async function copyFromReaderPath(
  allowedTypes: string[],
  deps: CopyPathCommandDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  const itemID = deps.getCurrentReaderItemID();
  if (!itemID) {
    return {
      ok: false,
      format: "none",
      count: 0,
      messageKey: "copy-reader-no-active",
    };
  }

  const files = await deps.resolveFromReader(itemID, allowedTypes);
  return writeExplicitPathText(files, deps);
}

function writeExplicitPathText(
  files: ResolvedAttachment[],
  deps: CopyPathCommandDeps,
): ClipboardResult {
  if (!files.length) {
    return {
      ok: false,
      format: "none",
      count: 0,
      outcome: "backend-unavailable",
      messageKey: "copy-no-files",
    };
  }

  const value = files.map((file) => file.clipboardPath || file.path).join("\n");
  if (!deps.writePathText(value)) {
    return {
      ok: false,
      format: "none",
      count: 0,
      outcome: "copy-failed",
      messageKey: "copy-clipboard-write-failed",
    };
  }

  return {
    ok: true,
    format: "path-text",
    count: files.length,
    outcome: "copied-path-text-explicit",
    messageKey: "copy-path-text-explicit",
  };
}
