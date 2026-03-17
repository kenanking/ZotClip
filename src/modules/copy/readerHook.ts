import { copyFromReader } from "./copyCommands";
import type { CopyActionState } from "./interaction/actions/copyActionTypes";
import { shouldHandleConfiguredShortcut } from "./shortcutGuard";
import type { ParsedShortcut } from "./shortcuts";
import { isActiveReaderTabSelected } from "./zoteroReaderAccess";
import { getAllowedAttachmentTypes } from "../../utils/prefs";

export interface ReaderHookDeps {
  getParsedShortcut(): ParsedShortcut | undefined;
  isReaderContext(event: KeyboardEvent): boolean;
  getActionState(): Promise<CopyActionState>;
}

const DEFAULT_DEPS: ReaderHookDeps = {
  getParsedShortcut: () => undefined,
  isReaderContext: () => isActiveReaderTabSelected(),
  getActionState: async () => ({
    source: "reader",
    refreshKey: "reader|default",
    primary: {
      kind: "copy-files",
      canExecute: true,
      run: async () => {
        return copyFromReader(getAllowedAttachmentTypes());
      },
    },
  }),
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

  const state = await finalDeps.getActionState();
  if (!state.primary.canExecute) {
    return false;
  }

  event.preventDefault();
  await state.primary.run();
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
