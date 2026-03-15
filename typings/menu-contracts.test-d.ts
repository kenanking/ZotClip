import type { CopyMenuRegistrationDeps } from "../src/modules/copy/menuCommands";

const validMenuDeps: CopyMenuRegistrationDeps = {
  addonRef: "zotclip",
  pluginID: "zotclip@cvrsg.dev",
  menuIcon: "chrome://zotclip/content/icons/favicon.svg",
  getLabel: () => "Copy File",
  getLibraryActionState: async () => ({
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
  getReaderActionState: async () => ({
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
    secondary: {
      kind: "copy-path",
      canExecute: true,
      run: async () => ({
        ok: true as const,
        format: "path-text" as const,
        count: 1,
        outcome: "copied-path-text-explicit" as const,
        messageKey: "copy-path-text-explicit" as const,
      }),
    },
  }),
};

void validMenuDeps;

const invalidLegacyMenuDeps: CopyMenuRegistrationDeps = {
  addonRef: "zotclip",
  pluginID: "zotclip@cvrsg.dev",
  menuIcon: "chrome://zotclip/content/icons/favicon.svg",
  getLabel: () => "Copy File",
  // @ts-expect-error Legacy selection menu callback must be removed.
  onCopySelection: async () => {},
};

const invalidLegacyReaderMenuDeps: CopyMenuRegistrationDeps = {
  addonRef: "zotclip",
  pluginID: "zotclip@cvrsg.dev",
  menuIcon: "chrome://zotclip/content/icons/favicon.svg",
  getLabel: () => "Copy File",
  // @ts-expect-error Legacy reader menu callback must be removed.
  onCopyReader: async () => {},
};

void invalidLegacyMenuDeps;
void invalidLegacyReaderMenuDeps;
