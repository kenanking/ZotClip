import { copyFromReader } from "./copyCommands";
import { shouldHandleConfiguredShortcut } from "./shortcutGuard";
import type { ParsedShortcut } from "./shortcuts";
import { getAllowedAttachmentTypes } from "../../utils/prefs";

export interface ReaderHookDeps {
  getParsedShortcut(): ParsedShortcut | undefined;
  isReaderContext(event: KeyboardEvent): boolean;
  triggerCopyFromReader(): Promise<void>;
}

const DEFAULT_DEPS: ReaderHookDeps = {
  getParsedShortcut: () => undefined,
  isReaderContext: () => {
    const tabs = ztoolkit.getGlobal("Zotero_Tabs") as
      | _ZoteroTypes.Zotero_Tabs
      | undefined;
    return tabs?.selectedType === "reader";
  },
  triggerCopyFromReader: async () => {
    await copyFromReader(getAllowedAttachmentTypes());
  },
};

export async function handleReaderCopyShortcut(
  event: KeyboardEvent,
  deps: Partial<ReaderHookDeps> = {},
): Promise<boolean> {
  const finalDeps: ReaderHookDeps = {
    ...DEFAULT_DEPS,
    ...deps,
  };

  if (
    !shouldHandleConfiguredShortcut(event, {
      getParsedShortcut: () => finalDeps.getParsedShortcut(),
      matchesContext: (nextEvent) => finalDeps.isReaderContext(nextEvent),
    })
  ) {
    return false;
  }

  event.preventDefault();
  await finalDeps.triggerCopyFromReader();
  return true;
}

export function registerReaderShortcutHandler(
  win: Window,
  shortcutProvider: () => ParsedShortcut | undefined,
  deps: Partial<ReaderHookDeps> = {},
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    void handleReaderCopyShortcut(event, {
      ...deps,
      getParsedShortcut: shortcutProvider,
    });
  };

  win.addEventListener("keydown", onKeyDown, true);
  return () => {
    win.removeEventListener("keydown", onKeyDown, true);
  };
}
