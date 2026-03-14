import assert from "node:assert/strict";
import test from "node:test";

import { formatCopyMessage } from "../../src/modules/copy/notifier";

test("formatCopyMessage renders dependency hints through the locale renderer", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: false,
        format: "none",
        count: 1,
        outcome: "dependency-missing",
        messageKey: "copy-macos-osascript-missing",
      },
      createRenderDeps("en-US"),
    ),
    "macOS osascript is required to copy files.",
  );
});

test("formatCopyMessage renders Chinese dependency hints through the locale renderer", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: false,
        format: "none",
        count: 0,
        outcome: "dependency-missing",
        messageKey: "copy-linux-wl-copy-missing",
      },
      createRenderDeps("zh-CN"),
    ),
    "要在 Wayland 中启用文件复制，请安装 wl-clipboard。",
  );
});

test("formatCopyMessage uses the file-object notification locale entry", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: true,
        format: "file-object",
        count: 2,
        outcome: "copied-files",
      },
      createRenderDeps("zh-CN"),
    ),
    "已复制 2 个附件文件到剪贴板（文件对象）。",
  );
});

test("formatCopyMessage uses the standard copied-files locale entry for non-file-object copies", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: true,
        format: "file-uri-list",
        count: 2,
        outcome: "copied-files",
      },
      createRenderDeps("zh-CN"),
    ),
    "已复制 2 个附件文件到剪贴板。",
  );
});

test("formatCopyMessage renders file URI notifications through the locale renderer", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: true,
        format: "file-uri-list",
        count: 1,
        outcome: "copied-file-uris",
      },
      createRenderDeps("fr-FR"),
    ),
    "Copied 1 attachment file URI(s) to clipboard.",
  );
});

test("formatCopyMessage renders structured copy failure reasons through the locale renderer", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: false,
        format: "none",
        count: 0,
        messageKey: "copy-reader-no-active",
      },
      createRenderDeps("zh-Hans"),
    ),
    "当前没有活动的阅读器附件。",
  );
});

test("formatCopyMessage renders fallback copy through the locale renderer", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: true,
        format: "path-text",
        count: 3,
        outcome: "copied-path-text-fallback",
        messageKey: "copy-path-text-fallback",
        messageArgs: { count: 3 },
      },
      createRenderDeps("en-US"),
    ),
    "Attachment file copy failed. Copied 3 attachment path(s) instead.",
  );
});

test("formatCopyMessage renders the generic failure locale entry when no message key is available", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: false,
        format: "none",
        count: 0,
        outcome: "copy-failed",
      },
      createRenderDeps("en-US"),
    ),
    "Copy failed. Please check file availability and clipboard support in target app.",
  );
});

function createRenderDeps(locale: string) {
  return {
    renderMessage(key: string, args?: Record<string, unknown>) {
      const messages = locale.toLowerCase().startsWith("zh")
        ? CHINESE_MESSAGES
        : ENGLISH_MESSAGES;
      const template = messages[key];
      assert.ok(template, `Missing test message for ${key}`);
      return interpolate(template, args);
    },
  };
}

function interpolate(
  template: string,
  args: Record<string, unknown> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key) => String(args[key]));
}

const ENGLISH_MESSAGES: Record<string, string> = {
  "copy-macos-osascript-missing": "macOS osascript is required to copy files.",
  "copy-linux-wl-copy-missing":
    "Install wl-clipboard to enable file copy on Wayland.",
  "copy-notify-files-file-object":
    "Copied {count} attachment file(s) to clipboard (file-object).",
  "copy-notify-files": "Copied {count} attachment file(s) to clipboard.",
  "copy-notify-file-uris":
    "Copied {count} attachment file URI(s) to clipboard.",
  "copy-reader-no-active": "No active reader attachment.",
  "copy-path-text-fallback":
    "Attachment file copy failed. Copied {count} attachment path(s) instead.",
  "copy-notify-generic-failure":
    "Copy failed. Please check file availability and clipboard support in target app.",
};

const CHINESE_MESSAGES: Record<string, string> = {
  "copy-macos-osascript-missing": "macOS 需要 osascript 才能复制文件。",
  "copy-linux-wl-copy-missing":
    "要在 Wayland 中启用文件复制，请安装 wl-clipboard。",
  "copy-notify-files-file-object":
    "已复制 {count} 个附件文件到剪贴板（文件对象）。",
  "copy-notify-files": "已复制 {count} 个附件文件到剪贴板。",
  "copy-notify-file-uris": "已复制 {count} 个附件文件 URI 到剪贴板。",
  "copy-reader-no-active": "当前没有活动的阅读器附件。",
  "copy-path-text-fallback":
    "附件文件复制失败，已改为复制 {count} 个附件路径。",
  "copy-notify-generic-failure":
    "复制失败。请检查文件是否可用，以及目标应用是否支持当前剪贴板格式。",
};
