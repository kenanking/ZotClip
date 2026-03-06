import { copyFromSelection } from "./copyCommands";

export interface SelectionHookDeps {
  isLibraryContext(event: KeyboardEvent): boolean;
  hasSelectedItems(): boolean;
  isEditableTarget(event: KeyboardEvent): boolean;
  triggerCopyFromSelection(): Promise<void>;
}

const DEFAULT_DEPS: SelectionHookDeps = {
  isLibraryContext: () => {
    const tabs = ztoolkit.getGlobal("Zotero_Tabs") as
      | _ZoteroTypes.Zotero_Tabs
      | undefined;
    return tabs?.selectedType !== "reader";
  },
  hasSelectedItems: () => {
    const pane = Zotero.getActiveZoteroPane();
    return ((pane?.getSelectedItems?.() || []) as Zotero.Item[]).length > 0;
  },
  isEditableTarget: (event) => isEditableNode(event.target),
  triggerCopyFromSelection: async () => {
    await copyFromSelection("all", true);
  },
};

export async function handleSelectionCopyShortcut(
  event: KeyboardEvent,
  deps: Partial<SelectionHookDeps> = {},
): Promise<boolean> {
  const finalDeps: SelectionHookDeps = {
    ...DEFAULT_DEPS,
    ...deps,
  };

  if (!finalDeps.isLibraryContext(event)) {
    return false;
  }

  const key = event.key.toLowerCase();
  const isCopyKey = key === "c";
  const hasMainModifier = event.ctrlKey || event.metaKey;
  const hasAlt = event.altKey;

  if (!isCopyKey || !hasMainModifier || hasAlt || event.shiftKey) {
    return false;
  }

  if (finalDeps.isEditableTarget(event) || !finalDeps.hasSelectedItems()) {
    return false;
  }

  event.preventDefault();
  await finalDeps.triggerCopyFromSelection();
  return true;
}

export function registerSelectionShortcutHandler(
  win: Window,
  deps: Partial<SelectionHookDeps> = {},
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    void handleSelectionCopyShortcut(event, deps);
  };

  win.addEventListener("keydown", onKeyDown, true);
  return () => {
    win.removeEventListener("keydown", onKeyDown, true);
  };
}

function isEditableNode(target: EventTarget | null): boolean {
  let node = target as Node | null;

  while (node) {
    const element = node as Element & {
      isContentEditable?: boolean;
    };
    const localName = element.localName?.toLowerCase();

    if (
      localName === "input" ||
      localName === "textarea" ||
      localName === "search-textbox"
    ) {
      return true;
    }

    if (element.isContentEditable) {
      return true;
    }

    const editable = element.getAttribute?.("contenteditable");
    if (editable === "" || editable === "true") {
      return true;
    }

    node = node.parentNode;
  }

  return false;
}
