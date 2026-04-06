import assert from "node:assert/strict";
import test from "node:test";

import { createKeyboardRegistry } from "../../src/modules/copy/interaction/keyboardRegistry";

test("keyboard registry registers one toolkit callback and disposes it", () => {
  let registered = 0;
  let unregistered = 0;

  const registry = createKeyboardRegistry({
    register: () => {
      registered += 1;
    },
    unregister: () => {
      unregistered += 1;
    },
    onLibraryShortcut: () => false,
    onReaderShortcut: () => false,
  });

  const handle = registry.start();
  handle.dispose();

  assert.equal(registered, 1);
  assert.equal(unregistered, 1);
});

test("keyboard registry only routes keydown events", async () => {
  const calls: string[] = [];
  let registeredCallback:
    | ((event: KeyboardEvent, options: { type: "keydown" | "keyup" }) => void)
    | undefined;

  const registry = createKeyboardRegistry({
    register: (callback) => {
      registeredCallback = callback;
    },
    unregister: () => {},
    onLibraryShortcut: async () => {
      calls.push("library");
      return false;
    },
    onReaderShortcut: async () => {
      calls.push("reader");
      return false;
    },
  });

  registry.start();
  registeredCallback?.({} as KeyboardEvent, { type: "keyup" });
  registeredCallback?.({} as KeyboardEvent, { type: "keydown" });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(calls, ["library", "reader"]);
});

test("keyboard registry skips reader handler when library handler returns true", async () => {
  const calls: string[] = [];
  let registeredCallback:
    | ((event: KeyboardEvent, options: { type: "keydown" | "keyup" }) => void)
    | undefined;

  const registry = createKeyboardRegistry({
    register: (callback) => {
      registeredCallback = callback;
    },
    unregister: () => {},
    onLibraryShortcut: async () => {
      calls.push("library");
      return true;
    },
    onReaderShortcut: async () => {
      calls.push("reader");
      return false;
    },
  });

  registry.start();
  registeredCallback?.({} as KeyboardEvent, { type: "keydown" });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(calls, ["library"]);
});

test("keyboard registry skips both handlers when event is already defaultPrevented", async () => {
  const calls: string[] = [];
  let registeredCallback:
    | ((event: KeyboardEvent, options: { type: "keydown" | "keyup" }) => void)
    | undefined;

  const registry = createKeyboardRegistry({
    register: (callback) => {
      registeredCallback = callback;
    },
    unregister: () => {},
    onLibraryShortcut: async () => {
      calls.push("library");
      return false;
    },
    onReaderShortcut: async () => {
      calls.push("reader");
      return false;
    },
  });

  registry.start();
  registeredCallback?.({ defaultPrevented: true } as KeyboardEvent, {
    type: "keydown",
  });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(calls, []);
});
