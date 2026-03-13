import assert from "node:assert/strict";
import test from "node:test";

import {
  getLibraryShortcut,
  getReaderShortcut,
  migrateLegacyShortcutPrefs,
} from "../../src/utils/prefs";
import { config } from "../../package.json";

const prefStore = new Map<string, string>();

(globalThis as any).Zotero = {
  Prefs: {
    get(key: string) {
      return prefStore.get(key);
    },
    set(key: string, value: string) {
      prefStore.set(key, value);
      return true;
    },
    clear(key: string) {
      prefStore.delete(key);
      return true;
    },
  },
};

test("getLibraryShortcut defaults to Ctrl+C", () => {
  prefStore.clear();

  assert.equal(getLibraryShortcut(), "Ctrl+C");
});

test("getReaderShortcut defaults to empty", () => {
  prefStore.clear();

  assert.equal(getReaderShortcut(), "");
});

test('migrateLegacyShortcutPrefs maps "always" to Ctrl+Shift+C', () => {
  assert.deepEqual(
    migrateLegacyShortcutPrefs({
      readerCtrlCMode: "always",
      readerShortcut: "",
    }),
    {
      readerShortcut: "Ctrl+Shift+C",
    },
  );
});

test("getReaderShortcut returns the stored shortcut", () => {
  prefStore.clear();
  prefStore.set(prefKey("readerShortcut"), "Alt+C");

  assert.equal(getReaderShortcut(), "Alt+C");
});

function prefKey(key: string): string {
  return `${config.prefsPrefix}.${key}`;
}
