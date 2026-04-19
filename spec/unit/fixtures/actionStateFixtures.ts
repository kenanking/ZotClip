// Shared test factories for CopyActionState and ClipboardResult objects.
// Used across keyboard-shortcuts, menu-commands, and toolbar button tests.

export function createCopyFilesResult() {
  return {
    ok: true as const,
    format: "file-object" as const,
    count: 1,
    outcome: "copied-files" as const,
  };
}

export function createPathCopyResult() {
  return {
    ok: true as const,
    format: "path-text" as const,
    count: 1,
    outcome: "copied-path-text-explicit" as const,
    messageKey: "copy-path-text-explicit" as const,
  };
}

export function createLibraryActionState(
  overrides: {
    canExecute?: boolean;
    reasonKey?: "copy-no-files";
    run?: () => Promise<ReturnType<typeof createCopyFilesResult>>;
  } = {},
) {
  return {
    source: "library" as const,
    refreshKey: "library|11",
    primary: {
      kind: "copy-files" as const,
      canExecute: overrides.canExecute ?? true,
      reasonKey: overrides.reasonKey,
      run:
        overrides.run ||
        (async () => {
          return createCopyFilesResult();
        }),
    },
  };
}

export function createReaderActionState(
  overrides: {
    canExecute?: boolean;
    reasonKey?: "copy-reader-no-active";
    run?: () => Promise<ReturnType<typeof createCopyFilesResult>>;
  } = {},
) {
  return {
    source: "reader" as const,
    refreshKey: "reader|2048",
    primary: {
      kind: "copy-files" as const,
      canExecute: overrides.canExecute ?? true,
      reasonKey: overrides.reasonKey,
      run:
        overrides.run ||
        (async () => {
          return createCopyFilesResult();
        }),
    },
  };
}
