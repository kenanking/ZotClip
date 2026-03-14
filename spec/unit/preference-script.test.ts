import assert from "node:assert/strict";
import test from "node:test";

import { buildClipboardDiagnostics } from "../../src/modules/copy/clipboard/diagnostics";
import { renderCopyDiagnosticsLine } from "../../src/modules/copy/copyMessages";
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
    commands: { "wl-copy": true },
    activeBackend: "linux-wayland-wl-copy-uri-list",
  });

  assert.deepEqual(diagnostics.lines[0], {
    key: "copy-diagnostics-platform-linux",
    args: { session: "wayland" },
  });
  assert.equal(
    renderCopyDiagnosticsLine(diagnostics.lines[0], createRenderDeps("en-US")),
    "Platform: linux (wayland)",
  );
  assert.equal(
    renderCopyDiagnosticsLine(diagnostics.lines[1], createRenderDeps("en-US")),
    "wl-copy: available",
  );
  assert.equal(
    renderCopyDiagnosticsLine(diagnostics.lines[2], createRenderDeps("en-US")),
    "Active backend: linux-wayland-wl-copy-uri-list",
  );
});

test("buildClipboardDiagnostics includes wl-clipboard install guidance on Wayland", () => {
  const diagnostics = buildClipboardDiagnostics({
    platform: "linux",
    linuxSession: "wayland",
    commands: { "wl-copy": false },
    activeBackend: "generic-clipboard-fallback",
  });

  assert.deepEqual(diagnostics.lines[3], {
    key: "copy-diagnostics-install-command",
    args: { command: "sudo apt install wl-clipboard" },
  });
  assert.equal(
    renderCopyDiagnosticsLine(diagnostics.lines[3], createRenderDeps("en-US")),
    "Install command: sudo apt install wl-clipboard",
  );
});

test("buildClipboardDiagnostics includes a Chinese install command for the GTK4 helper", () => {
  const diagnostics = buildClipboardDiagnostics({
    platform: "linux",
    linuxSession: "x11",
    commands: { "gtk4-helper": false },
    activeBackend: "generic-clipboard-fallback",
  });

  assert.equal(
    renderCopyDiagnosticsLine(diagnostics.lines[0], createRenderDeps("zh-CN")),
    "平台：linux (x11)",
  );
  assert.equal(
    renderCopyDiagnosticsLine(diagnostics.lines[3], createRenderDeps("zh-CN")),
    "安装命令：sudo apt install python3-gi gir1.2-gtk-4.0",
  );
});

test("buildClipboardDiagnostics does not show install guidance when a Linux backend is already active", () => {
  const diagnostics = buildClipboardDiagnostics({
    platform: "linux",
    linuxSession: "unknown",
    commands: {
      "gtk4-helper": false,
      "wl-copy": true,
    },
    activeBackend: "linux-wayland-wl-copy-uri-list",
  });

  assert.equal(
    diagnostics.lines.some(
      (line) => line.key === "copy-diagnostics-install-command",
    ),
    false,
  );
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

function createRenderDeps(locale: string) {
  return {
    renderMessage(key: string, args?: Record<string, unknown>) {
      const messages = locale.toLowerCase().startsWith("zh")
        ? CHINESE_MESSAGES
        : ENGLISH_MESSAGES;
      const template = messages[key];
      assert.ok(template, `Missing diagnostics message for ${key}`);
      return template.replace(/\{(\w+)\}/g, (_match, name) =>
        String(args?.[name]),
      );
    },
  };
}

const ENGLISH_MESSAGES: Record<string, string> = {
  "copy-diagnostics-platform-linux": "Platform: linux ({session})",
  "copy-diagnostics-command-available": "{command}: available",
  "copy-diagnostics-command-missing": "{command}: missing",
  "copy-diagnostics-active-backend": "Active backend: {backend}",
  "copy-diagnostics-install-command": "Install command: {command}",
  "copy-diagnostics-troubleshoot":
    "If issues persist, troubleshoot your system clipboard environment manually.",
};

const CHINESE_MESSAGES: Record<string, string> = {
  "copy-diagnostics-platform-linux": "平台：linux ({session})",
  "copy-diagnostics-command-available": "{command}：可用",
  "copy-diagnostics-command-missing": "{command}：缺失",
  "copy-diagnostics-active-backend": "当前后端：{backend}",
  "copy-diagnostics-install-command": "安装命令：{command}",
  "copy-diagnostics-troubleshoot": "如果仍有问题，请自行排查系统剪贴板环境。",
};
