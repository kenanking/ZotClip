import assert from "node:assert/strict";
import test from "node:test";

import {
  composeDisposables,
  createListenerDisposer,
  createNoopHandle,
} from "../../src/utils/disposables";

test("composeDisposables disposes all callbacks once", () => {
  const calls: string[] = [];
  const handle = composeDisposables(
    () => calls.push("first"),
    () => calls.push("second"),
  );

  handle.dispose();
  handle.dispose();

  assert.deepEqual(calls, ["first", "second"]);
});

test("createListenerDisposer unregisters one event listener", () => {
  const events: string[] = [];
  const target = {
    addEventListener: (_type: string, _listener: EventListener) => {
      events.push("add");
    },
    removeEventListener: (_type: string, _listener: EventListener) => {
      events.push("remove");
    },
  } as unknown as EventTarget;

  const dispose = createListenerDisposer(
    target,
    "change",
    (() => {}) as EventListener,
  );
  dispose();

  assert.deepEqual(events, ["add", "remove"]);
});

test("createNoopHandle exposes a stable dispose method", () => {
  assert.equal(typeof createNoopHandle().dispose, "function");
});
