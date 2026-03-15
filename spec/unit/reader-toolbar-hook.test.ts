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
