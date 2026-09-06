import { notifyCopyResult } from "./notifier";
import { copyFromSelection } from "./copyCommands";
import type { CopyActionState } from "./interaction/actions/copyActionTypes";
import { shouldHandleConfiguredShortcut } from "./shortcutGuard";
import { parseShortcut, type ParsedShortcut } from "./shortcuts";
import { getAllowedAttachmentTypes } from "../../utils/prefs";

export interface SelectionHookDeps {
  getParsedShortcut(): ParsedShortcut | undefined;
  isLibraryContext(event: KeyboardEvent): boolean;
  hasSelectedItems(event: KeyboardEvent): boolean;
  isEditableTarget(event: KeyboardEvent): boolean;
  getActionState(): Promise<CopyActionState>;
}

const DEFAULT_SELECTION_SHORTCUT = parseShortcut("Ctrl+C");

const DEFAULT_DEPS: SelectionHookDeps = {
  getParsedShortcut: () => DEFAULT_SELECTION_SHORTCUT,
  isLibraryContext: (event) =>
    Boolean((event.target as Element | null)?.closest?.("#zotero-items-tree")),
  hasSelectedItems: (event) => {
    const pane =
      (event.view as _ZoteroTypes.MainWindow | null)?.ZoteroPane ||
      Zotero.getActiveZoteroPane();
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

  if (finalDeps.isEditableTarget(event) || !finalDeps.hasSelectedItems(event)) {
    return false;
  }

  event.preventDefault();
  const state = await finalDeps.getActionState();
  if (!state.primary.canExecute) {
    notifyCopyResult({
      ok: false,
      format: "none",
      count: 0,
      messageKey: state.primary.reasonKey || "copy-no-files",
    });
    return true;
  }

  await state.primary.run();
  return true;
}

export function registerSelectionShortcutHandler(
  win: Window,
  deps: Partial<SelectionHookDeps> = {},
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    void handleSelectionCopyShortcut(event, deps).catch(reportCopyError);
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

export function reportCopyError(error: unknown): void {
  Zotero.logError(error instanceof Error ? error : new Error(String(error)));
  notifyCopyResult({
    ok: false,
    format: "none",
    count: 0,
    messageKey: "copy-clipboard-write-failed",
  });
}
