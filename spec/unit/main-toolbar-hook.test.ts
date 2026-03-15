import assert from "node:assert/strict";
import test from "node:test";

import { registerMainToolbarCopyButton } from "../../src/hooks";

test("main toolbar integration skips registration when the preference is disabled", () => {
  let mountCalls = 0;

  const dispose = registerMainToolbarCopyButton(
    { document: {} as Document } as Window,
    {
      isEnabled: () => false,
      mountButton: () => {
        mountCalls += 1;
        return {
          refresh: async () => {},
          dispose: () => {},
        };
      },
    },
  );

  assert.equal(mountCalls, 0);
  dispose();
});

test("main toolbar integration registers the button when the preference is enabled", () => {
  let mountCalls = 0;
  let disposeCalls = 0;

  const dispose = registerMainToolbarCopyButton(
    {
      document: {
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as Document,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as Window,
    {
      isEnabled: () => true,
      mountButton: () => {
        mountCalls += 1;
        return {
          refresh: async () => {},
          dispose: () => {
            disposeCalls += 1;
          },
        };
      },
    },
  );

  assert.equal(mountCalls, 1);
  dispose();
  assert.equal(disposeCalls, 1);
});

test("main toolbar integration passes controller-backed action state to the toolbar registration", () => {
  let receivedGetActionState: undefined | (() => Promise<unknown>);

  const dispose = registerMainToolbarCopyButton(
    {
      document: {
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as Document,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as Window,
    {
      isEnabled: () => true,
      getActionState: async () => ({
        source: "library",
        refreshKey: "library|11",
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
      }),
      mountButton: (_doc, deps) => {
        receivedGetActionState = deps.getActionState;
        return {
          refresh: async () => {},
          dispose: () => {},
        };
      },
    },
  );

  assert.equal(typeof receivedGetActionState, "function");
  dispose();
});
