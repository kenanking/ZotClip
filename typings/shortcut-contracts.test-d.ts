import type { ReaderHookDeps } from "../src/modules/copy/readerHook";
import type { SelectionHookDeps } from "../src/modules/copy/selectionHook";

const validSelectionHookDeps: SelectionHookDeps = {
  getParsedShortcut: () => undefined,
  isLibraryContext: () => true,
  hasSelectedItems: () => true,
  isEditableTarget: () => false,
  getActionState: async () => ({
    source: "library",
    refreshKey: "library|11",
    primary: {
      kind: "copy-files",
      canExecute: true,
      run: async () => ({
        ok: true as const,
        format: "file-object" as const,
        count: 1,
        outcome: "copied-files" as const,
      }),
    },
  }),
};

const validReaderHookDeps: ReaderHookDeps = {
  getParsedShortcut: () => undefined,
  isReaderContext: () => true,
  getActionState: async () => ({
    source: "reader",
    refreshKey: "reader|11",
    primary: {
      kind: "copy-files",
      canExecute: true,
      run: async () => ({
        ok: true as const,
        format: "file-object" as const,
        count: 1,
        outcome: "copied-files" as const,
      }),
    },
  }),
};

void validSelectionHookDeps;
void validReaderHookDeps;

const invalidLegacySelectionHookDeps: SelectionHookDeps = {
  getParsedShortcut: () => undefined,
  isLibraryContext: () => true,
  hasSelectedItems: () => true,
  isEditableTarget: () => false,
  // @ts-expect-error Legacy selection trigger contract must be removed.
  triggerCopyFromSelection: async () => {},
};

const invalidLegacyReaderHookDeps: ReaderHookDeps = {
  getParsedShortcut: () => undefined,
  isReaderContext: () => true,
  // @ts-expect-error Legacy reader trigger contract must be removed.
  triggerCopyFromReader: async () => {},
};

void invalidLegacySelectionHookDeps;
void invalidLegacyReaderHookDeps;
