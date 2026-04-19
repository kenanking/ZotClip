import assert from "node:assert/strict";
import test from "node:test";

import { registerMainToolbarCopyButton } from "../../src/toolbar/buttonRegistration";

const DEBOUNCE_SETTLE_MS = 150;

class FakeWindow {
  document = {} as Document;
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) || new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type);
    listeners?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) || []) {
      listener(new Event(type));
    }
  }
}

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

test("main toolbar integration debounces repeated window events before refreshing", async () => {
  const win = new FakeWindow();
  let refreshCalls = 0;

  const dispose = registerMainToolbarCopyButton(win as unknown as Window, {
    isEnabled: () => true,
    mountButton: () => ({
      refresh: async () => {
        refreshCalls += 1;
      },
      dispose: () => {},
    }),
  });

  assert.equal(refreshCalls, 1);

  win.dispatch("focus");
  win.dispatch("mouseup");
  win.dispatch("keyup");

  assert.equal(refreshCalls, 1);

  await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_SETTLE_MS));

  assert.equal(refreshCalls, 2);
  dispose();
});

test("main toolbar integration cancels a pending debounced refresh on dispose", async () => {
  const win = new FakeWindow();
  let refreshCalls = 0;

  const dispose = registerMainToolbarCopyButton(win as unknown as Window, {
    isEnabled: () => true,
    mountButton: () => ({
      refresh: async () => {
        refreshCalls += 1;
      },
      dispose: () => {},
    }),
  });

  assert.equal(refreshCalls, 1);

  win.dispatch("keyup");
  dispose();
  await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_SETTLE_MS));

  assert.equal(refreshCalls, 1);
});
