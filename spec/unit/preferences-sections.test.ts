import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildEffectiveAttachmentTypes,
  validateAttachmentTypeSelection,
} from "../../src/modules/copy/preferences/attachmentTypesSection";
import { registerPrefsUI } from "../../src/modules/copy/preferences/registerPrefsUI";
import {
  areShortcutInputsConflicting,
  normalizeShortcutInput,
  validateShortcutInput,
} from "../../src/modules/copy/preferences/shortcutsSection";
import {
  persistToolbarButtonPrefs,
  readToolbarButtonVisibility,
} from "../../src/modules/copy/preferences/toolbarButtonsSection";

test("attachment types section builds effective types from presets and custom input", () => {
  assert.deepEqual(
    buildEffectiveAttachmentTypes(["pdf", "epub"], " .djvu, azw3 "),
    ["pdf", "epub", "djvu", "azw3"],
  );
});

test("attachment types section rejects empty selections", () => {
  assert.equal(validateAttachmentTypeSelection([], " , . "), false);
});

test("shortcuts section normalizes and validates shortcut input", () => {
  assert.equal(normalizeShortcutInput(" shift + ctrl + c "), "Ctrl+Shift+C");
  assert.equal(validateShortcutInput("Ctrl+Shift+C"), true);
  assert.equal(validateShortcutInput("Ctrl+"), false);
  assert.equal(
    areShortcutInputsConflicting("Ctrl+Shift+C", "Ctrl+Shift+C"),
    true,
  );
});

test("toolbar buttons section reads and persists visibility values", () => {
  const calls: Array<{ key: string; value: boolean }> = [];

  const visibility = readToolbarButtonVisibility({
    mainToolbarCheckbox: { checked: false } as HTMLInputElement,
    readerToolbarCheckbox: { checked: true } as HTMLInputElement,
  });

  persistToolbarButtonPrefs(
    {
      mainToolbarCheckbox: { checked: false } as HTMLInputElement,
      readerToolbarCheckbox: { checked: true } as HTMLInputElement,
    },
    (key, value) => {
      calls.push({ key, value });
      return true;
    },
  );

  assert.deepEqual(visibility, {
    showMainToolbarButton: false,
    showReaderToolbarButton: true,
  });
  assert.deepEqual(calls, [
    { key: "showMainToolbarButton", value: false },
    { key: "showReaderToolbarButton", value: true },
  ]);
});

test("registerPrefsUI disposes an earlier registration before re-registering the same window", async () => {
  const windowStub = {
    document: {} as Document,
  } as Window;
  const callLog: string[] = [];

  const deps = {
    syncPreferenceMenulists: () => {
      callLog.push("sync-menulists");
    },
    registerAttachmentTypesSection: async () => {
      callLog.push("register-attachment-types");
      return {
        dispose: () => {
          callLog.push("dispose-attachment-types");
        },
      };
    },
    registerToolbarButtonsSection: async () => {
      callLog.push("register-toolbar-buttons");
      return {
        dispose: () => {
          callLog.push("dispose-toolbar-buttons");
        },
      };
    },
    registerShortcutsSection: async () => {
      callLog.push("register-shortcuts");
      return {
        dispose: () => {
          callLog.push("dispose-shortcuts");
        },
      };
    },
    registerDiagnosticsSection: async () => {
      callLog.push("register-diagnostics");
      return {
        dispose: () => {
          callLog.push("dispose-diagnostics");
        },
      };
    },
  };

  const first = await registerPrefsUI(windowStub, deps);
  const second = await registerPrefsUI(windowStub, deps);

  assert.deepEqual(callLog, [
    "sync-menulists",
    "register-attachment-types",
    "register-toolbar-buttons",
    "register-shortcuts",
    "register-diagnostics",
    "dispose-attachment-types",
    "dispose-toolbar-buttons",
    "dispose-shortcuts",
    "dispose-diagnostics",
    "sync-menulists",
    "register-attachment-types",
    "register-toolbar-buttons",
    "register-shortcuts",
    "register-diagnostics",
  ]);

  first.dispose();
  second.dispose();
});

test("preferences markup uses compact inline rows for targeted settings fields", () => {
  const markup = readFileSync(
    new URL("../../addon/content/preferences.xhtml", import.meta.url),
    "utf8",
  );

  assert.match(markup, /data-zotclip-toolbar-buttons-row="true"/);
  assert.match(markup, /data-zotclip-inline-field="custom-types"/);
  assert.match(markup, /data-zotclip-inline-field="library-shortcut"/);
  assert.match(markup, /data-zotclip-inline-field="reader-shortcut"/);
  assert.doesNotMatch(markup, /pref-library-shortcut-help/);
  assert.doesNotMatch(markup, /pref-reader-shortcut-help/);
  assert.doesNotMatch(markup, /pref-main-toolbar-button-help/);
  assert.doesNotMatch(markup, /pref-reader-toolbar-button-help/);
});

test("preferences locale strings match the compact settings layout", () => {
  const zh = readFileSync(
    new URL("../../addon/locale/zh-CN/preferences.ftl", import.meta.url),
    "utf8",
  );
  const en = readFileSync(
    new URL("../../addon/locale/en-US/preferences.ftl", import.meta.url),
    "utf8",
  );

  assert.match(zh, /^pref-toolbar-buttons-help = /m);
  assert.match(en, /^pref-toolbar-buttons-help = /m);
  assert.match(zh, /^pref-custom-types = .*：$/m);
  assert.match(zh, /^pref-library-shortcut = .*：$/m);
  assert.match(zh, /^pref-reader-shortcut = .*：$/m);
  assert.match(en, /^pref-custom-types = .*:$/m);
  assert.match(en, /^pref-library-shortcut = .*:$/m);
  assert.match(en, /^pref-reader-shortcut = .*:$/m);
  assert.doesNotMatch(zh, /^pref-main-toolbar-button-help = /m);
  assert.doesNotMatch(zh, /^pref-reader-toolbar-button-help = /m);
  assert.doesNotMatch(zh, /^pref-library-shortcut-help = /m);
  assert.doesNotMatch(zh, /^pref-reader-shortcut-help = /m);
  assert.doesNotMatch(en, /^pref-main-toolbar-button-help = /m);
  assert.doesNotMatch(en, /^pref-reader-toolbar-button-help = /m);
  assert.doesNotMatch(en, /^pref-library-shortcut-help = /m);
  assert.doesNotMatch(en, /^pref-reader-shortcut-help = /m);
});
