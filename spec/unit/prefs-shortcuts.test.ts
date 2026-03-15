import assert from "node:assert/strict";
import test from "node:test";

import * as prefs from "../../src/utils/prefs";
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

  assert.equal(prefs.getLibraryShortcut(), "Ctrl+C");
});

test("getReaderShortcut defaults to empty", () => {
  prefStore.clear();

  assert.equal(prefs.getReaderShortcut(), "");
});

test("main toolbar button visibility defaults to enabled", () => {
  prefStore.clear();

  assert.equal(prefs.getMainToolbarButtonEnabled(), true);
});

test("reader toolbar button visibility defaults to enabled", () => {
  prefStore.clear();

  assert.equal(prefs.getReaderToolbarButtonEnabled(), true);
});

test("getReaderShortcut returns the stored shortcut", () => {
  prefStore.clear();
  prefStore.set(prefKey("readerShortcut"), "Alt+C");

  assert.equal(prefs.getReaderShortcut(), "Alt+C");
});

function prefKey(key: string): string {
  return `${config.prefsPrefix}.${key}`;
}
