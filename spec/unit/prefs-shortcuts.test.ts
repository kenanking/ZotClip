import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("prefs module no longer exports legacy reader shortcut migration helpers", () => {
  assert.equal("migrateLegacyShortcutPrefs" in prefs, false);
  assert.equal("migrateShortcutPrefs" in prefs, false);
});

test("preference defaults no longer define readerCtrlCMode", () => {
  const prefsFile = readFileSync("addon/prefs.js", "utf8");

  assert.equal(prefsFile.includes('pref("readerCtrlCMode"'), false);
});

test("preference defaults define both toolbar button toggles", () => {
  const prefsFile = readFileSync("addon/prefs.js", "utf8");

  assert.equal(prefsFile.includes('pref("showMainToolbarButton", true)'), true);
  assert.equal(
    prefsFile.includes('pref("showReaderToolbarButton", true)'),
    true,
  );
});

test("getReaderShortcut returns the stored shortcut", () => {
  prefStore.clear();
  prefStore.set(prefKey("readerShortcut"), "Alt+C");

  assert.equal(prefs.getReaderShortcut(), "Alt+C");
});

function prefKey(key: string): string {
  return `${config.prefsPrefix}.${key}`;
}
