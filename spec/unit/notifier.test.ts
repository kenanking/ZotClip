import assert from "node:assert/strict";
import test from "node:test";

import { formatCopyMessage } from "../../src/modules/copy/notifier";

test("formatCopyMessage prefers the structured fallback message", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: true,
        format: "path-text",
        count: 1,
        outcome: "copied-path-text-fallback",
        message:
          "Install python3-gi and gir1.2-gtk-4.0 to enable Linux file copy.",
      },
      {
        getLanguage: () => "en-US",
      },
    ),
    "Install python3-gi and gir1.2-gtk-4.0 to enable Linux file copy.",
  );
});

test("formatCopyMessage returns dependency messages directly", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: false,
        format: "none",
        count: 1,
        outcome: "dependency-missing",
        message: "macOS osascript is required to copy files.",
      },
      {
        getLanguage: () => "en-US",
      },
    ),
    "macOS osascript is required to copy files.",
  );
});

test("formatCopyMessage uses Chinese when the language starts with zh", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: true,
        format: "file-object",
        count: 2,
        outcome: "copied-files",
      },
      {
        getLanguage: () => "zh-CN",
      },
    ),
    "已复制 2 个附件文件到剪贴板（文件对象）。",
  );
});

test("formatCopyMessage uses a generic success message for non-file-object copies", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: true,
        format: "file-uri-list",
        count: 2,
        outcome: "copied-files",
      },
      {
        getLanguage: () => "zh-CN",
      },
    ),
    "已复制 2 个附件文件到剪贴板。",
  );
});

test("formatCopyMessage falls back to English for non-Chinese languages", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: true,
        format: "file-uri-list",
        count: 1,
        outcome: "copied-file-uris",
      },
      {
        getLanguage: () => "fr-FR",
      },
    ),
    "Copied 1 attachment file URI(s) to clipboard.",
  );
});

test("formatCopyMessage localizes known failure messages in Chinese", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: false,
        format: "none",
        count: 0,
        message: "No active reader attachment.",
      },
      {
        getLanguage: () => "zh-Hans",
      },
    ),
    "当前没有活动的阅读器附件。",
  );
});

test("formatCopyMessage localizes the GTK4 helper dependency hint in Chinese", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: false,
        format: "none",
        count: 0,
        outcome: "dependency-missing",
        message:
          "Install python3-gi and gir1.2-gtk-4.0 to enable Linux file copy.",
      },
      {
        getLanguage: () => "zh-CN",
      },
    ),
    "要在 Linux 中启用文件复制，请安装 python3-gi 和 gir1.2-gtk-4.0。",
  );
});

test("formatCopyMessage localizes the wl-clipboard dependency hint in Chinese", () => {
  assert.equal(
    formatCopyMessage(
      {
        ok: false,
        format: "none",
        count: 0,
        outcome: "dependency-missing",
        message: "Install wl-clipboard to enable file copy on Wayland.",
      },
      {
        getLanguage: () => "zh-CN",
      },
    ),
    "要在 Wayland 中启用文件复制，请安装 wl-clipboard。",
  );
});
