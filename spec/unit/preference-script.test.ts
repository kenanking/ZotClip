import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildClipboardDiagnostics } from "../../src/modules/copy/clipboard/diagnostics";
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
  assert.equal(
    areShortcutInputsConflicting("Ctrl+Shift+C", "Ctrl+Shift+C"),
    true,
  );
  assert.equal(areShortcutInputsConflicting("Ctrl+C", ""), false);
});

test("buildClipboardDiagnostics summarizes detected commands and backend", () => {
  const diagnostics = buildClipboardDiagnostics({
    platform: "linux",
    linuxSession: "wayland",
    commands: { "wl-copy": true, xclip: false },
    activeBackend: "linux-wayland-wl-copy-uri-list",
    languageTag: "en-US",
  });

  assert.equal(diagnostics.lines[0], "Platform: linux (wayland)");
  assert.match(diagnostics.lines[1], /wl-copy: available/);
  assert.match(diagnostics.lines[2], /xclip: missing/);
  assert.equal(
    diagnostics.lines[3],
    "Active backend: linux-wayland-wl-copy-uri-list",
  );
});

test("buildClipboardDiagnostics includes a simple install command on Wayland", () => {
  const diagnostics = buildClipboardDiagnostics({
    platform: "linux",
    linuxSession: "wayland",
    commands: { "wl-copy": false },
    activeBackend: "generic-clipboard-fallback",
    languageTag: "en-US",
  });

  assert.match(
    diagnostics.lines.join("\n"),
    /Install command: sudo apt install wl-clipboard/,
  );
});

test("buildClipboardDiagnostics includes a Chinese install command on X11", () => {
  const diagnostics = buildClipboardDiagnostics({
    platform: "linux",
    linuxSession: "x11",
    commands: { xclip: false },
    activeBackend: "generic-clipboard-fallback",
    languageTag: "zh-CN",
  });

  assert.match(diagnostics.lines[0], /平台：linux \(x11\)/);
  assert.match(
    diagnostics.lines.join("\n"),
    /安装命令：sudo apt install xclip/,
  );
});

test("English shortcut locale copy explains the separate reader behavior", () => {
  const englishLocale = readFileSync(
    "addon/locale/en-US/preferences.ftl",
    "utf8",
  );

  assert.match(englishLocale, /Library and reader shortcuts are separate\./);
  assert.match(
    englishLocale,
    /Ctrl\+C in the reader keeps its original behavior and is not overridden\./,
  );
  assert.match(englishLocale, /No shortcut is set in the reader by default\./);
});

test("Chinese shortcut locale copy explains the separate reader behavior", () => {
  const chineseLocale = readFileSync(
    "addon/locale/zh-CN/preferences.ftl",
    "utf8",
  );

  assert.match(chineseLocale, /条目面板和阅读器面板的快捷键互不共用/);
  assert.match(chineseLocale, /阅读器中的 Ctrl\+C 会保留原有功能/);
  assert.match(chineseLocale, /阅读器默认不设置快捷键/);
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
