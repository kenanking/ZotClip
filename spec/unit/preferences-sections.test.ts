import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEffectiveAttachmentTypes,
  validateAttachmentTypeSelection,
} from "../../src/modules/copy/preferences/attachmentTypesSection";
import { registerDiagnosticsSection } from "../../src/modules/copy/preferences/diagnosticsSection";
import { registerPrefsUI } from "../../src/modules/copy/preferences/registerPrefsUI";
import {
  areShortcutInputsConflicting,
  normalizeShortcutInput,
  persistShortcutPrefs,
  validateShortcutInput,
} from "../../src/modules/copy/preferences/shortcutsSection";

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

test("persistShortcutPrefs keeps invalid shortcut text visible and skips persistence", () => {
  const calls: Array<{ key: string; value: string }> = [];
  const controls = {
    libraryInput: {
      value: "Ctrl+",
      dataset: {},
    } as HTMLInputElement,
    readerInput: {
      value: "Ctrl+Shift+C",
      dataset: {},
    } as HTMLInputElement,
    validationMessage: {
      hidden: true,
    } as HTMLElement,
    conflictMessage: {
      hidden: true,
    } as HTMLElement,
  };

  persistShortcutPrefs(controls, (key, value) => {
    calls.push({ key, value });
    return true;
  });

  assert.equal(controls.libraryInput.value, "Ctrl+");
  assert.equal(controls.readerInput.value, "Ctrl+Shift+C");
  assert.equal(controls.libraryInput.dataset.invalid, "true");
  assert.equal(controls.readerInput.dataset.invalid, "false");
  assert.equal(controls.validationMessage.hidden, false);
  assert.deepEqual(calls, []);
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
    registerInterfaceSection: async () => {
      callLog.push("register-interface");
      return {
        dispose: () => {
          callLog.push("dispose-interface");
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
    "register-interface",
    "register-shortcuts",
    "register-diagnostics",
    "dispose-attachment-types",
    "dispose-interface",
    "dispose-shortcuts",
    "dispose-diagnostics",
    "sync-menulists",
    "register-attachment-types",
    "register-interface",
    "register-shortcuts",
    "register-diagnostics",
  ]);

  first.dispose();
  second.dispose();
});

test("registerPrefsUI dispose is idempotent for the same registration handle", async () => {
  const windowStub = {
    document: {} as Document,
  } as Window;
  let disposals = 0;

  const handle = await registerPrefsUI(windowStub, {
    syncPreferenceMenulists: () => {},
    registerAttachmentTypesSection: async () => ({
      dispose: () => {
        disposals += 1;
      },
    }),
    registerInterfaceSection: async () => ({
      dispose: () => {
        disposals += 1;
      },
    }),
    registerShortcutsSection: async () => ({
      dispose: () => {
        disposals += 1;
      },
    }),
    registerDiagnosticsSection: async () => ({
      dispose: () => {
        disposals += 1;
      },
    }),
  });

  handle.dispose();
  handle.dispose();

  assert.equal(disposals, 4);
});

class FakeDiagnosticsElement {
  className = "";
  textContent = "";
  children: FakeDiagnosticsElement[] = [];
  hidden = false;

  append(...nodes: FakeDiagnosticsElement[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeDiagnosticsElement[]): void {
    this.children = [...nodes];
  }
}

class FakeDiagnosticsDocument {
  readonly list = new FakeDiagnosticsElement();

  querySelector(selector: string): FakeDiagnosticsElement | null {
    if (selector === "[data-zotclip-diagnostics-list]") {
      return this.list;
    }

    return null;
  }

  createElement(_tagName: string): FakeDiagnosticsElement {
    return new FakeDiagnosticsElement();
  }
}

test("diagnostics section renders one inline row per diagnostics line", async () => {
  const doc = new FakeDiagnosticsDocument();

  await registerDiagnosticsSection(doc as unknown as Document, {
    getClipboardDiagnostics: async () => ({
      platform: "linux",
      linuxSession: "x11",
      commands: {},
      activeBackend: "linux-gtk4",
      lines: [
        {
          key: "copy-diagnostics-platform-linux",
        },
        {
          key: "copy-diagnostics-active-backend",
        },
      ],
    }),
    renderLine: (line) => line.key,
  });

  assert.equal(doc.list.children.length, 2);
  assert.equal(
    doc.list.children[0].textContent,
    "copy-diagnostics-platform-linux",
  );
  assert.equal(
    doc.list.children[1].textContent,
    "copy-diagnostics-active-backend",
  );
});
