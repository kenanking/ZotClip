import { copyFromReader } from "./copyCommands";
import { matchesShortcut, parseShortcut } from "./shortcuts";
import { getAllowedAttachmentTypes } from "../../utils/prefs";

export interface ReaderHookDeps {
  getShortcut(): string;
  isReaderContext(event: KeyboardEvent): boolean;
  triggerCopyFromReader(): Promise<void>;
}

const DEFAULT_DEPS: ReaderHookDeps = {
  getShortcut: () => "",
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
  if (event.defaultPrevented) {
    return false;
  }

  const finalDeps: ReaderHookDeps = {
    ...DEFAULT_DEPS,
    ...deps,
  };

  if (!finalDeps.isReaderContext(event)) {
    return false;
  }

  const shortcut = parseShortcut(finalDeps.getShortcut());
  if (!matchesShortcut(shortcut, event)) {
    return false;
  }

  event.preventDefault();
  await finalDeps.triggerCopyFromReader();
  return true;
}

export function registerReaderShortcutHandler(
  win: Window,
  shortcutProvider: () => string,
  deps: Partial<ReaderHookDeps> = {},
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    void handleReaderCopyShortcut(event, {
      ...deps,
      getShortcut: shortcutProvider,
    });
  };

  win.addEventListener("keydown", onKeyDown, true);
  return () => {
    win.removeEventListener("keydown", onKeyDown, true);
  };
}
