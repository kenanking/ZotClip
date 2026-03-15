import type { MainToolbarButtonDeps } from "../src/modules/copy/mainToolbarButton";
import type { ReaderToolbarButtonDeps } from "../src/modules/copy/readerToolbarButton";

const validMainToolbarDeps: MainToolbarButtonDeps = {
  getLabel: () => "Copy File",
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

const validReaderToolbarDeps: ReaderToolbarButtonDeps = {
  getLabel: () => "Copy File",
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

void validMainToolbarDeps;
void validReaderToolbarDeps;

const invalidLegacyMainToolbarDeps: MainToolbarButtonDeps = {
  getLabel: () => "Copy File",
  // @ts-expect-error Legacy main toolbar availability contract must be removed.
  getAvailability: async () => ({ canCopy: true }),
};

const invalidLegacyReaderToolbarDeps: ReaderToolbarButtonDeps = {
  getLabel: () => "Copy File",
  // @ts-expect-error Legacy reader toolbar availability contract must be removed.
  getAvailability: async () => ({ canCopy: true }),
};

const invalidLegacyMainToolbarCommandDeps: MainToolbarButtonDeps = {
  getLabel: () => "Copy File",
  // @ts-expect-error Legacy main toolbar command contract must be removed.
  onCommand: async () => {},
};

const invalidLegacyReaderToolbarCommandDeps: ReaderToolbarButtonDeps = {
  getLabel: () => "Copy File",
  // @ts-expect-error Legacy reader toolbar command contract must be removed.
  onCommand: async () => {},
};

void invalidLegacyMainToolbarDeps;
void invalidLegacyReaderToolbarDeps;
void invalidLegacyMainToolbarCommandDeps;
void invalidLegacyReaderToolbarCommandDeps;
