import { copyFromReader } from "./copyCommands";
import type { CopyActionState } from "./interaction/actions/copyActionTypes";
import { isReaderTabSelected } from "./interaction/readerContext";
import { shouldHandleConfiguredShortcut } from "./shortcutGuard";
import type { ParsedShortcut } from "./shortcuts";
import { getAllowedAttachmentTypes } from "../../utils/prefs";

export interface ReaderHookDeps {
  getParsedShortcut(): ParsedShortcut | undefined;
  isReaderContext(event: KeyboardEvent): boolean;
  triggerCopyFromReader(): Promise<void>;
  getActionState?(): Promise<CopyActionState>;
}

const DEFAULT_DEPS: ReaderHookDeps = {
  getParsedShortcut: () => undefined,
  isReaderContext: () => {
    return isReaderTabSelected({
      getTabs: () =>
        ztoolkit.getGlobal("Zotero_Tabs") as
          | _ZoteroTypes.Zotero_Tabs
          | undefined,
    });
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

  if (finalDeps.getActionState) {
    const state = await finalDeps.getActionState();
    if (!state.primary.canExecute) {
      return false;
    }

    await state.primary.run();
    return true;
  }

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
