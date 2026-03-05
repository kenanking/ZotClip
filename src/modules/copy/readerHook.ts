import { copyFromReader } from "./copyCommands";

export type ReaderCtrlCMode = "smart" | "never" | "always";

export interface ReaderHookDeps {
  isReaderContext(event: KeyboardEvent): boolean;
  hasTextSelection(event: KeyboardEvent): boolean;
  triggerCopyFromReader(): Promise<void>;
}

const DEFAULT_DEPS: ReaderHookDeps = {
  isReaderContext: () => {
    const tabs = ztoolkit.getGlobal("Zotero_Tabs") as
      | _ZoteroTypes.Zotero_Tabs
      | undefined;
    return tabs?.selectedType === "reader";
  },
  hasTextSelection: (event) => {
    const ownerDocument = (event.target as Node | null)?.ownerDocument;
    const selection = ownerDocument?.getSelection?.() || event.view?.getSelection?.();
    return !!selection && selection.toString().trim().length > 0;
  },
  triggerCopyFromReader: async () => {
    await copyFromReader(true);
  },
};

export async function handleReaderCopyShortcut(
  event: KeyboardEvent,
  mode: ReaderCtrlCMode,
  deps: ReaderHookDeps = DEFAULT_DEPS,
): Promise<boolean> {
  if (!deps.isReaderContext(event)) {
    return false;
  }

  const key = event.key.toLowerCase();
  const isCopyKey = key === "c";
  const hasMainModifier = event.ctrlKey || event.metaKey;
  const hasAlt = event.altKey;

  if (!isCopyKey || !hasMainModifier || hasAlt) {
    return false;
  }

  const isPrimaryCombo = !event.shiftKey;
  const isFallbackCombo = event.shiftKey;

  if (isPrimaryCombo) {
    if (mode === "never") {
      return false;
    }

    if (mode === "smart" && deps.hasTextSelection(event)) {
      return false;
    }
  } else if (!isFallbackCombo) {
    return false;
  }

  event.preventDefault();
  await deps.triggerCopyFromReader();
  return true;
}

export function registerReaderShortcutHandler(
  win: Window,
  modeProvider: () => ReaderCtrlCMode,
  deps: ReaderHookDeps = DEFAULT_DEPS,
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    void handleReaderCopyShortcut(event, modeProvider(), deps);
  };

  win.addEventListener("keydown", onKeyDown, true);
  return () => {
    win.removeEventListener("keydown", onKeyDown, true);
  };
}
