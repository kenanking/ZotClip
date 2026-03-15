import { copyFromSelection } from "./copyCommands";
import type { CopyActionState } from "./interaction/actions/copyActionTypes";
import { isReaderTabSelected } from "./interaction/readerContext";
import { shouldHandleConfiguredShortcut } from "./shortcutGuard";
import { parseShortcut, type ParsedShortcut } from "./shortcuts";
import { getAllowedAttachmentTypes } from "../../utils/prefs";

export interface SelectionHookDeps {
  getParsedShortcut(): ParsedShortcut | undefined;
  isLibraryContext(event: KeyboardEvent): boolean;
  hasSelectedItems(): boolean;
  isEditableTarget(event: KeyboardEvent): boolean;
  getActionState(): Promise<CopyActionState>;
}

const DEFAULT_SELECTION_SHORTCUT = parseShortcut("Ctrl+C");

const DEFAULT_DEPS: SelectionHookDeps = {
  getParsedShortcut: () => DEFAULT_SELECTION_SHORTCUT,
  isLibraryContext: () => {
    return !isReaderTabSelected({
      getTabs: () =>
        ztoolkit.getGlobal("Zotero_Tabs") as
          | _ZoteroTypes.Zotero_Tabs
          | undefined,
    });
  },
  hasSelectedItems: () => {
    const pane = Zotero.getActiveZoteroPane();
    return ((pane?.getSelectedItems?.() || []) as Zotero.Item[]).length > 0;
  },
  isEditableTarget: (event) => isEditableNode(event.target),
  getActionState: async () => ({
    source: "library",
    refreshKey: "library|default",
    primary: {
      kind: "copy-files",
      canExecute: true,
      run: async () => {
        return copyFromSelection("all", getAllowedAttachmentTypes());
      },
    },
  }),
};

export async function handleSelectionCopyShortcut(
  event: KeyboardEvent,
  deps: Partial<SelectionHookDeps> = {},
): Promise<boolean> {
  const finalDeps: SelectionHookDeps = {
    ...DEFAULT_DEPS,
    ...deps,
  };

  if (
    !shouldHandleConfiguredShortcut(event, {
      getParsedShortcut: () => finalDeps.getParsedShortcut(),
      matchesContext: (nextEvent) => finalDeps.isLibraryContext(nextEvent),
    })
  ) {
    return false;
  }

  if (finalDeps.isEditableTarget(event) || !finalDeps.hasSelectedItems()) {
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
