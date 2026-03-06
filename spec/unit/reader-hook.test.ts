import assert from "node:assert/strict";
import test from "node:test";

import { handleReaderCopyShortcut } from "../../src/modules/copy/readerHook";

function makeKeyEvent(options: {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  key?: string;
  defaultPrevented?: boolean;
}) {
  let prevented = false;
  const event = {
    ctrlKey: options.ctrl ?? true,
    metaKey: options.meta ?? false,
    shiftKey: options.shift ?? false,
    altKey: false,
    defaultPrevented: options.defaultPrevented ?? false,
    key: options.key ?? "c",
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

test("reader hook does not intercept Ctrl+C when selection exists in smart mode", async () => {
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

test("reader hook intercepts Ctrl+C when selection is empty in smart mode", async () => {
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

test("reader hook ignores copy events that were already intercepted", async () => {
  const mock = makeKeyEvent({
    ctrl: true,
    key: "c",
    defaultPrevented: true,
  });
  let copyCalled = false;

  const intercepted = await handleReaderCopyShortcut(mock.event, "smart", {
    isReaderContext: () => true,
    hasTextSelection: () => false,
    triggerCopyFromReader: async () => {
      copyCalled = true;
    },
  });

  assert.equal(intercepted, false);
  assert.equal(copyCalled, false);
});

test("reader hook does not copy the same event twice after preventDefault", async () => {
  const mock = makeKeyEvent({ ctrl: true, key: "c" });
  let copyCount = 0;

  const deps = {
    isReaderContext: () => true,
    hasTextSelection: () => false,
    triggerCopyFromReader: async () => {
      copyCount += 1;
    },
  };

  const firstIntercept = await handleReaderCopyShortcut(
    mock.event,
    "smart",
    deps,
  );
  const secondIntercept = await handleReaderCopyShortcut(
    mock.event,
    "smart",
    deps,
  );

  assert.equal(firstIntercept, true);
  assert.equal(secondIntercept, false);
  assert.equal(copyCount, 1);
  assert.equal(mock.wasPrevented(), true);
});

test("reader hook intercepts Ctrl+Shift+C as fallback even in never mode", async () => {
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
