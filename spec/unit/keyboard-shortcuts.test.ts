import assert from "node:assert/strict";
import test from "node:test";

import { handleReaderCopyShortcut } from "../../src/modules/copy/readerHook";
import { handleSelectionCopyShortcut } from "../../src/modules/copy/selectionHook";

function makeKeyEvent(options: {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  key?: string;
  target?: EventTarget | null;
  defaultPrevented?: boolean;
}) {
  let prevented = false;
  const event = {
    ctrlKey: options.ctrl ?? true,
    metaKey: options.meta ?? false,
    shiftKey: options.shift ?? false,
    altKey: false,
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

test("keyboard shortcuts: library copy intercepts Ctrl+C when items are selected", async () => {
  const mock = makeKeyEvent({ ctrl: true, key: "c" });
  let copyCalled = false;

  const intercepted = await handleSelectionCopyShortcut(mock.event, {
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
  const editable = makeKeyEvent({ ctrl: true, key: "c" });
  const empty = makeKeyEvent({ ctrl: true, key: "c" });

  const editableIntercepted = await handleSelectionCopyShortcut(
    editable.event,
    {
      isLibraryContext: () => true,
      hasSelectedItems: () => true,
      isEditableTarget: () => true,
      triggerCopyFromSelection: async () => undefined,
    },
  );
  const emptyIntercepted = await handleSelectionCopyShortcut(empty.event, {
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

test("keyboard shortcuts: reader smart mode preserves native copy when text is selected", async () => {
  const mock = makeKeyEvent({ ctrl: true, key: "c" });
  let copyCalled = false;

  const intercepted = await handleReaderCopyShortcut(mock.event, "smart", {
    isReaderContext: () => true,
    hasTextSelection: () => true,
    triggerCopyFromReader: async () => {
      copyCalled = true;
    },
  });

  assert.equal(intercepted, false);
  assert.equal(copyCalled, false);
  assert.equal(mock.wasPrevented(), false);
});

test("keyboard shortcuts: reader smart mode intercepts Ctrl+C when selection is empty", async () => {
  const mock = makeKeyEvent({ ctrl: true, key: "c" });
  let copyCalled = false;

  const intercepted = await handleReaderCopyShortcut(mock.event, "smart", {
    isReaderContext: () => true,
    hasTextSelection: () => false,
    triggerCopyFromReader: async () => {
      copyCalled = true;
    },
  });

  assert.equal(intercepted, true);
  assert.equal(copyCalled, true);
  assert.equal(mock.wasPrevented(), true);
});

test("keyboard shortcuts: reader fallback shortcut intercepts Ctrl+Shift+C even in never mode", async () => {
  const mock = makeKeyEvent({ ctrl: true, shift: true, key: "c" });
  let copyCalled = false;

  const intercepted = await handleReaderCopyShortcut(mock.event, "never", {
    isReaderContext: () => true,
    hasTextSelection: () => true,
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
    key: "c",
    defaultPrevented: true,
  });
  const selection = makeKeyEvent({
    ctrl: true,
    key: "c",
    defaultPrevented: true,
  });

  const readerIntercepted = await handleReaderCopyShortcut(
    reader.event,
    "smart",
    {
      isReaderContext: () => true,
      hasTextSelection: () => false,
      triggerCopyFromReader: async () => undefined,
    },
  );
  const selectionIntercepted = await handleSelectionCopyShortcut(
    selection.event,
    {
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
  const reader = makeKeyEvent({ ctrl: true, key: "c" });
  const selection = makeKeyEvent({ ctrl: true, key: "c" });
  let readerCount = 0;
  let selectionCount = 0;

  const readerDeps = {
    isReaderContext: () => true,
    hasTextSelection: () => false,
    triggerCopyFromReader: async () => {
      readerCount += 1;
    },
  };
  const selectionDeps = {
    isLibraryContext: () => true,
    hasSelectedItems: () => true,
    isEditableTarget: () => false,
    triggerCopyFromSelection: async () => {
      selectionCount += 1;
    },
  };

  const firstReaderIntercept = await handleReaderCopyShortcut(
    reader.event,
    "smart",
    readerDeps,
  );
  const secondReaderIntercept = await handleReaderCopyShortcut(
    reader.event,
    "smart",
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
