import assert from "node:assert/strict";
import test from "node:test";

import { handleReaderCopyShortcut } from "../../src/modules/copy/readerHook";
import { handleSelectionCopyShortcut } from "../../src/modules/copy/selectionHook";
import type { ParsedShortcut } from "../../src/modules/copy/shortcuts";
import {
  createCopyFilesResult,
  createLibraryActionState,
  createReaderActionState,
} from "./fixtures/actionStateFixtures";

const CTRL_SHIFT_C: ParsedShortcut = {
  ctrlOrMeta: true,
  alt: false,
  shift: true,
  key: "c",
};

function makeKeyEvent(options: {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  key?: string;
  target?: EventTarget | null;
  defaultPrevented?: boolean;
}) {
  let prevented = false;
  const event = {
    ctrlKey: options.ctrl ?? true,
    metaKey: options.meta ?? false,
    shiftKey: options.shift ?? false,
    altKey: options.alt ?? false,
    key: options.key ?? "c",
    target: options.target ?? null,
    defaultPrevented: options.defaultPrevented ?? false,
    preventDefault: () => {
      prevented = true;
      event.defaultPrevented = true;
    },
  } as unknown as KeyboardEvent;

  return {
    event,
    wasPrevented: () => prevented,
  };
}

test("keyboard shortcuts: library copy intercepts the configured shortcut when items are selected", async () => {
  const mock = makeKeyEvent({ ctrl: true, shift: true, key: "c" });
  let copyCalled = false;

  const intercepted = await handleSelectionCopyShortcut(mock.event, {
    getParsedShortcut: () => CTRL_SHIFT_C,
    isLibraryContext: () => true,
    hasSelectedItems: () => true,
    isEditableTarget: () => false,
    getActionState: async () =>
      createLibraryActionState({
        run: async () => {
          copyCalled = true;
          return createCopyFilesResult();
        },
      }),
  });

  assert.equal(intercepted, true);
  assert.equal(copyCalled, true);
  assert.equal(mock.wasPrevented(), true);
});

test("keyboard shortcuts: library copy skips editable targets and empty selections", async () => {
  const editable = makeKeyEvent({ ctrl: true, shift: true, key: "c" });
  const empty = makeKeyEvent({ ctrl: true, shift: true, key: "c" });

  const editableIntercepted = await handleSelectionCopyShortcut(
    editable.event,
    {
      getParsedShortcut: () => CTRL_SHIFT_C,
      isLibraryContext: () => true,
      hasSelectedItems: () => true,
      isEditableTarget: () => true,
      getActionState: async () => createLibraryActionState(),
    },
  );
  const emptyIntercepted = await handleSelectionCopyShortcut(empty.event, {
    getParsedShortcut: () => CTRL_SHIFT_C,
    isLibraryContext: () => true,
    hasSelectedItems: () => false,
    isEditableTarget: () => false,
    getActionState: async () => createLibraryActionState(),
  });

  assert.equal(editableIntercepted, false);
  assert.equal(emptyIntercepted, false);
  assert.equal(editable.wasPrevented(), false);
  assert.equal(empty.wasPrevented(), false);
});

test("keyboard shortcuts: reader keeps native copy when no shortcut is configured", async () => {
  const mock = makeKeyEvent({ ctrl: true, key: "c" });
  const copyCalled = false;

  const intercepted = await handleReaderCopyShortcut(mock.event, {
    getParsedShortcut: () => undefined,
    isReaderContext: () => true,
    getActionState: async () => createReaderActionState(),
  });

  assert.equal(intercepted, false);
  assert.equal(copyCalled, false);
  assert.equal(mock.wasPrevented(), false);
});

test("keyboard shortcuts: reader intercepts the configured shortcut", async () => {
  const mock = makeKeyEvent({ ctrl: true, shift: true, key: "c" });
  let copyCalled = false;

  const intercepted = await handleReaderCopyShortcut(mock.event, {
    getParsedShortcut: () => CTRL_SHIFT_C,
    isReaderContext: () => true,
    getActionState: async () =>
      createReaderActionState({
        run: async () => {
          copyCalled = true;
          return createCopyFilesResult();
        },
      }),
  });

  assert.equal(intercepted, true);
  assert.equal(copyCalled, true);
  assert.equal(mock.wasPrevented(), true);
});

test("keyboard shortcuts: already handled events are ignored", async () => {
  const reader = makeKeyEvent({
    ctrl: true,
    shift: true,
    key: "c",
    defaultPrevented: true,
  });
  const selection = makeKeyEvent({
    ctrl: true,
    shift: true,
    key: "c",
    defaultPrevented: true,
  });

  const readerIntercepted = await handleReaderCopyShortcut(reader.event, {
    getParsedShortcut: () => CTRL_SHIFT_C,
    isReaderContext: () => true,
    getActionState: async () => createReaderActionState(),
  });
  const selectionIntercepted = await handleSelectionCopyShortcut(
    selection.event,
    {
      getParsedShortcut: () => CTRL_SHIFT_C,
      isLibraryContext: () => true,
      hasSelectedItems: () => true,
      isEditableTarget: () => false,
      getActionState: async () => createLibraryActionState(),
    },
  );

  assert.equal(readerIntercepted, false);
  assert.equal(selectionIntercepted, false);
});

test("keyboard shortcuts: the same event is not handled twice", async () => {
  const reader = makeKeyEvent({ ctrl: true, shift: true, key: "c" });
  const selection = makeKeyEvent({ ctrl: true, shift: true, key: "c" });
  let readerCount = 0;
  let selectionCount = 0;

  const readerDeps = {
    getParsedShortcut: () => CTRL_SHIFT_C,
    isReaderContext: () => true,
    getActionState: async () =>
      createReaderActionState({
        run: async () => {
          readerCount += 1;
          return createCopyFilesResult();
        },
      }),
  };
  const selectionDeps = {
    getParsedShortcut: () => CTRL_SHIFT_C,
    isLibraryContext: () => true,
    hasSelectedItems: () => true,
    isEditableTarget: () => false,
    getActionState: async () =>
      createLibraryActionState({
        run: async () => {
          selectionCount += 1;
          return createCopyFilesResult();
        },
      }),
  };

  const firstReaderIntercept = await handleReaderCopyShortcut(
    reader.event,
    readerDeps,
  );
  const secondReaderIntercept = await handleReaderCopyShortcut(
    reader.event,
    readerDeps,
  );
  const firstSelectionIntercept = await handleSelectionCopyShortcut(
    selection.event,
    selectionDeps,
  );
  const secondSelectionIntercept = await handleSelectionCopyShortcut(
    selection.event,
    selectionDeps,
  );

  assert.equal(firstReaderIntercept, true);
  assert.equal(secondReaderIntercept, false);
  assert.equal(firstSelectionIntercept, true);
  assert.equal(secondSelectionIntercept, false);
  assert.equal(readerCount, 1);
  assert.equal(selectionCount, 1);
});

test("keyboard shortcuts: handlers can reuse one parsed shortcut across repeated events", async () => {
  const first = makeKeyEvent({ ctrl: true, shift: true, key: "c" });
  const second = makeKeyEvent({ ctrl: true, shift: true, key: "c" });
  let parsedShortcutCalls = 0;

  const deps = {
    getParsedShortcut: () => {
      parsedShortcutCalls += 1;
      return CTRL_SHIFT_C;
    },
    isLibraryContext: () => true,
    hasSelectedItems: () => true,
    isEditableTarget: () => false,
    getActionState: async () => createLibraryActionState(),
  };

  await handleSelectionCopyShortcut(first.event, deps);
  await handleSelectionCopyShortcut(second.event, deps);

  assert.equal(parsedShortcutCalls, 2);
});

test("keyboard shortcuts: library copy can execute the primary action from action state", async () => {
  const mock = makeKeyEvent({ ctrl: true, shift: true, key: "c" });
  let runCalls = 0;

  const intercepted = await handleSelectionCopyShortcut(mock.event, {
    getParsedShortcut: () => CTRL_SHIFT_C,
    isLibraryContext: () => true,
    hasSelectedItems: () => true,
    isEditableTarget: () => false,
    getActionState: async () => ({
      source: "library",
      refreshKey: "library|11",
      primary: {
        kind: "copy-files",
        canExecute: true,
        run: async () => {
          runCalls += 1;
          return createCopyFilesResult();
        },
      },
    }),
  });

  assert.equal(intercepted, true);
  assert.equal(runCalls, 1);
  assert.equal(mock.wasPrevented(), true);
});

// Factories imported from shared fixtures — see fixtures/actionStateFixtures.ts
