import assert from "node:assert/strict";
import test from "node:test";

import {
  areShortcutInputsConflicting,
  buildEffectiveAttachmentTypes,
  normalizeShortcutInput,
  syncMenulistValue,
  validateShortcutInput,
  validateAttachmentTypeSelection,
} from "../../src/modules/preferenceScript";

test("preference script builds effective types from presets and custom input", () => {
  assert.deepEqual(
    buildEffectiveAttachmentTypes(["pdf", "epub"], " .djvu, azw3 "),
    ["pdf", "epub", "djvu", "azw3"],
  );
});

test("preference script rejects empty attachment-type selection", () => {
  assert.equal(validateAttachmentTypeSelection([], " , . "), false);
});

test("preference script syncs menulist visible value from stored prefs", () => {
  const menulist = createFakeMenulist(["all", "primary"]);

  const syncedValue = syncMenulistValue(menulist, "primary");

  assert.equal(syncedValue, "primary");
  assert.equal(menulist.value, "primary");
  assert.equal(menulist.selectedItem?.value, "primary");
});

test("preference script falls back to the first menu item for invalid values", () => {
  const menulist = createFakeMenulist(["smart", "never", "always"]);

  const syncedValue = syncMenulistValue(menulist, "invalid");

  assert.equal(syncedValue, "smart");
  assert.equal(menulist.value, "smart");
  assert.equal(menulist.selectedItem?.value, "smart");
});

test("preference script normalizes shortcut input", () => {
  assert.equal(normalizeShortcutInput(" shift + ctrl + c "), "Ctrl+Shift+C");
  assert.equal(normalizeShortcutInput(""), "");
});

test("preference script validates shortcut input", () => {
  assert.equal(validateShortcutInput("Ctrl+Shift+C"), true);
  assert.equal(validateShortcutInput("Ctrl+"), false);
});

test("preference script detects conflicting shortcuts", () => {
  assert.equal(areShortcutInputsConflicting("Ctrl+Shift+C", "Ctrl+Shift+C"), true);
  assert.equal(areShortcutInputsConflicting("Ctrl+C", ""), false);
});

function createFakeMenulist(values: string[]) {
  const items = values.map((value) => ({ value }));

  return {
    value: "",
    selectedItem: null,
    querySelectorAll(selector: string) {
      if (selector === "menuitem") {
        return items;
      }
      return [];
    },
  };
}
