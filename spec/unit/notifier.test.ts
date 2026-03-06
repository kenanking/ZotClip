import assert from "node:assert/strict";
import test from "node:test";
import pkg from "../../package.json";

import {
  formatCopyMessage,
  getCopyResultNotificationType,
  notifyCopyResult,
} from "../../src/modules/copy/notifier";

test("notifier formats fallback message with count", () => {
  const message = formatCopyMessage({
    ok: true,
    format: "path-text",
    count: 2,
    fallbackUsed: true,
  });

  assert.equal(
    message,
    "Attachment file copy failed. Copied 2 attachment path(s) instead.",
  );
});

test("notifier formats success message with attachment wording", () => {
  const message = formatCopyMessage({
    ok: true,
    format: "file-object",
    count: 2,
  });

  assert.equal(
    message,
    "Copied 2 attachment file(s) to clipboard (file-object).",
  );
});

test("notifier uses fail styling when fallback paths are copied", () => {
  const type = getCopyResultNotificationType({
    ok: true,
    format: "path-text",
    count: 1,
    fallbackUsed: true,
  });

  assert.equal(type, "fail");
});

test("notifier prefers explicit failure message when provided", () => {
  const message = formatCopyMessage({
    ok: false,
    format: "none",
    count: 1,
    message: "Windows file clipboard is unavailable in Zotero.",
  });

  assert.equal(message, "Windows file clipboard is unavailable in Zotero.");
});

test("notifier uses the plugin SVG icon for successful copy notifications", () => {
  const lines: Array<Record<string, unknown>> = [];
  const originalZtoolkit = globalThis.ztoolkit;
  const originalAddon = globalThis.addon;

  class FakeProgressWindow {
    constructor(_title: string, _options: Record<string, unknown>) {}

    createLine(options: Record<string, unknown>) {
      lines.push(options);
      return this;
    }

    show() {
      return this;
    }
  }

  globalThis.ztoolkit = {
    ProgressWindow: FakeProgressWindow,
  } as typeof globalThis.ztoolkit;
  globalThis.addon = {
    data: {
      config: {
        addonName: pkg.config.addonName,
      },
    },
  } as typeof globalThis.addon;

  try {
    notifyCopyResult({
      ok: true,
      format: "file-object",
      count: 1,
    });
  } finally {
    globalThis.ztoolkit = originalZtoolkit;
    globalThis.addon = originalAddon;
  }

  assert.equal(lines.length, 1);
  assert.equal(
    lines[0].icon,
    `chrome://${pkg.config.addonRef}/content/icons/favicon.svg`,
  );
  assert.equal(lines[0].type, undefined);
});

test("notifier uses the plugin SVG icon for fallback notifications", () => {
  const lines: Array<Record<string, unknown>> = [];
  const originalZtoolkit = globalThis.ztoolkit;
  const originalAddon = globalThis.addon;

  class FakeProgressWindow {
    constructor(_title: string, _options: Record<string, unknown>) {}

    createLine(options: Record<string, unknown>) {
      lines.push(options);
      return this;
    }

    show() {
      return this;
    }
  }

  globalThis.ztoolkit = {
    ProgressWindow: FakeProgressWindow,
  } as typeof globalThis.ztoolkit;
  globalThis.addon = {
    data: {
      config: {
        addonName: pkg.config.addonName,
      },
    },
  } as typeof globalThis.addon;

  try {
    notifyCopyResult({
      ok: true,
      format: "path-text",
      count: 1,
      fallbackUsed: true,
    });
  } finally {
    globalThis.ztoolkit = originalZtoolkit;
    globalThis.addon = originalAddon;
  }

  assert.equal(lines.length, 1);
  assert.equal(
    lines[0].icon,
    `chrome://${pkg.config.addonRef}/content/icons/favicon.svg`,
  );
  assert.equal(lines[0].type, undefined);
});

test("notifier uses the plugin SVG icon for failed copy notifications", () => {
  const lines: Array<Record<string, unknown>> = [];
  const originalZtoolkit = globalThis.ztoolkit;
  const originalAddon = globalThis.addon;

  class FakeProgressWindow {
    constructor(_title: string, _options: Record<string, unknown>) {}

    createLine(options: Record<string, unknown>) {
      lines.push(options);
      return this;
    }

    show() {
      return this;
    }
  }

  globalThis.ztoolkit = {
    ProgressWindow: FakeProgressWindow,
  } as typeof globalThis.ztoolkit;
  globalThis.addon = {
    data: {
      config: {
        addonName: pkg.config.addonName,
      },
    },
  } as typeof globalThis.addon;

  try {
    notifyCopyResult({
      ok: false,
      format: "none",
      count: 1,
      message: "Clipboard write failed.",
    });
  } finally {
    globalThis.ztoolkit = originalZtoolkit;
    globalThis.addon = originalAddon;
  }

  assert.equal(lines.length, 1);
  assert.equal(
    lines[0].icon,
    `chrome://${pkg.config.addonRef}/content/icons/favicon.svg`,
  );
  assert.equal(lines[0].type, undefined);
});
