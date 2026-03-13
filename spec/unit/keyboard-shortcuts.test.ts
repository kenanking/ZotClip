import assert from "node:assert/strict";
import test from "node:test";

import { handleReaderCopyShortcut } from "../../src/modules/copy/readerHook";
import { handleSelectionCopyShortcut } from "../../src/modules/copy/selectionHook";

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
    getShortcut: () => "Ctrl+Shift+C",
    isLibraryContext: () => true,
    hasSelectedItems: () => true,
    isEditableTarget: () => false,
    triggerCopyFromSelection: async () => {
      copyCalled = true;
    },
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
      getShortcut: () => "Ctrl+Shift+C",
      isLibraryContext: () => true,
      hasSelectedItems: () => true,
      isEditableTarget: () => true,
      triggerCopyFromSelection: async () => undefined,
    },
  );
  const emptyIntercepted = await handleSelectionCopyShortcut(empty.event, {
    getShortcut: () => "Ctrl+Shift+C",
    isLibraryContext: () => true,
    hasSelectedItems: () => false,
    isEditableTarget: () => false,
    triggerCopyFromSelection: async () => undefined,
  });

  assert.equal(editableIntercepted, false);
  assert.equal(emptyIntercepted, false);
  assert.equal(editable.wasPrevented(), false);
  assert.equal(empty.wasPrevented(), false);
});

test("keyboard shortcuts: reader keeps native copy when no shortcut is configured", async () => {
  const mock = makeKeyEvent({ ctrl: true, key: "c" });
  let copyCalled = false;

  const intercepted = await handleReaderCopyShortcut(mock.event, {
    getShortcut: () => "",
    isReaderContext: () => true,
    triggerCopyFromReader: async () => {
      copyCalled = true;
    },
  });

  assert.equal(intercepted, false);
  assert.equal(copyCalled, false);
  assert.equal(mock.wasPrevented(), false);
});

test("keyboard shortcuts: reader intercepts the configured shortcut", async () => {
  const mock = makeKeyEvent({ ctrl: true, shift: true, key: "c" });
  let copyCalled = false;

  const intercepted = await handleReaderCopyShortcut(mock.event, {
    getShortcut: () => "Ctrl+Shift+C",
    isReaderContext: () => true,
    triggerCopyFromReader: async () => {
      copyCalled = true;
    },
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
    getShortcut: () => "Ctrl+Shift+C",
    isReaderContext: () => true,
    triggerCopyFromReader: async () => undefined,
  });
  const selectionIntercepted = await handleSelectionCopyShortcut(
    selection.event,
    {
      getShortcut: () => "Ctrl+Shift+C",
      isLibraryContext: () => true,
      hasSelectedItems: () => true,
      isEditableTarget: () => false,
      triggerCopyFromSelection: async () => undefined,
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
    getShortcut: () => "Ctrl+Shift+C",
    isReaderContext: () => true,
    triggerCopyFromReader: async () => {
      readerCount += 1;
    },
  };
  const selectionDeps = {
    getShortcut: () => "Ctrl+Shift+C",
    isLibraryContext: () => true,
    hasSelectedItems: () => true,
    isEditableTarget: () => false,
    triggerCopyFromSelection: async () => {
      selectionCount += 1;
    },
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
