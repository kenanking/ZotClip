import assert from "node:assert/strict";
import test from "node:test";

import { registerPrefsScripts } from "../../src/modules/preferenceScript";

test("preference script delegates prefs window setup to the copy prefs UI registrar", async () => {
  const windowStub = {} as Window;
  const calls: Window[] = [];

  const handle = await registerPrefsScripts(windowStub, {
    registerPrefsUI: async (win) => {
      calls.push(win);
      return {
        dispose: () => {},
      };
    },
  });

  assert.deepEqual(calls, [windowStub]);
  handle.dispose();
});
