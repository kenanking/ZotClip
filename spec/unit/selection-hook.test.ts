import assert from "node:assert/strict";
import test from "node:test";

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

test("selection hook intercepts Ctrl+C in library when items are selected", async () => {
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

test("selection hook does not intercept Ctrl+C for editable targets", async () => {
  const mock = makeKeyEvent({ ctrl: true, key: "c" });
  let copyCalled = false;

  const intercepted = await handleSelectionCopyShortcut(mock.event, {
    isLibraryContext: () => true,
    hasSelectedItems: () => true,
    isEditableTarget: () => true,
    triggerCopyFromSelection: async () => {
      copyCalled = true;
    },
  });

  assert.equal(intercepted, false);
  assert.equal(copyCalled, false);
  assert.equal(mock.wasPrevented(), false);
});

test("selection hook ignores copy events that were already intercepted", async () => {
  const mock = makeKeyEvent({
    ctrl: true,
    key: "c",
    defaultPrevented: true,
  });
  let copyCalled = false;

  const intercepted = await handleSelectionCopyShortcut(mock.event, {
    isLibraryContext: () => true,
    hasSelectedItems: () => true,
    isEditableTarget: () => false,
    triggerCopyFromSelection: async () => {
      copyCalled = true;
    },
  });

  assert.equal(intercepted, false);
  assert.equal(copyCalled, false);
  assert.equal(mock.wasPrevented(), false);
});

test("selection hook does not copy the same event twice after preventDefault", async () => {
  const mock = makeKeyEvent({ ctrl: true, key: "c" });
  let copyCount = 0;

  const deps = {
    isLibraryContext: () => true,
    hasSelectedItems: () => true,
    isEditableTarget: () => false,
    triggerCopyFromSelection: async () => {
      copyCount += 1;
    },
  };

  const firstIntercept = await handleSelectionCopyShortcut(mock.event, deps);
  const secondIntercept = await handleSelectionCopyShortcut(mock.event, deps);

  assert.equal(firstIntercept, true);
  assert.equal(secondIntercept, false);
  assert.equal(copyCount, 1);
  assert.equal(mock.wasPrevented(), true);
});

test("selection hook does not intercept Ctrl+C when nothing is selected", async () => {
  const mock = makeKeyEvent({ ctrl: true, key: "c" });
  let copyCalled = false;

  const intercepted = await handleSelectionCopyShortcut(mock.event, {
    isLibraryContext: () => true,
    hasSelectedItems: () => false,
    isEditableTarget: () => false,
    triggerCopyFromSelection: async () => {
      copyCalled = true;
    },
  });

  assert.equal(intercepted, false);
  assert.equal(copyCalled, false);
  assert.equal(mock.wasPrevented(), false);
});
