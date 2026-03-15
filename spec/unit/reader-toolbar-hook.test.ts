import assert from "node:assert/strict";
import test from "node:test";

import { registerReaderToolbarCopyButton } from "../../src/hooks";

test("reader toolbar integration skips registration when the preference is disabled", () => {
  let registerCalls = 0;

  const dispose = registerReaderToolbarCopyButton({
    isEnabled: () => false,
    registerButton: () => {
      registerCalls += 1;
      return () => {};
    },
  });

  assert.equal(registerCalls, 0);
  dispose();
});

test("reader toolbar integration registers the button when the preference is enabled", () => {
  let registerCalls = 0;
  let disposeCalls = 0;

  const dispose = registerReaderToolbarCopyButton({
    isEnabled: () => true,
    registerButton: () => {
      registerCalls += 1;
      return () => {
        disposeCalls += 1;
      };
    },
  });

  assert.equal(registerCalls, 1);
  dispose();
  assert.equal(disposeCalls, 1);
});

test("reader toolbar integration passes controller-backed action state to the toolbar registration", () => {
  let receivedGetActionState: undefined | (() => Promise<unknown>);

  const dispose = registerReaderToolbarCopyButton({
    isEnabled: () => true,
    getActionState: async () => ({
      source: "reader",
      refreshKey: "reader|2048",
      primary: {
        kind: "copy-files",
        canExecute: true,
        run: async () => ({
          ok: true,
          format: "file-object",
          count: 1,
          outcome: "copied-files",
        }),
      },
      secondary: {
        kind: "copy-path",
        canExecute: true,
        run: async () => ({
          ok: true,
          format: "path-text",
          count: 1,
          outcome: "copied-path-text-explicit",
          messageKey: "copy-path-text-explicit",
        }),
      },
    }),
    registerButton: (deps) => {
      receivedGetActionState = deps.getActionState;
      return () => {};
    },
  });

  assert.equal(typeof receivedGetActionState, "function");
  dispose();
});
