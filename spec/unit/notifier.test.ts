import assert from "node:assert/strict";
import test from "node:test";

import { formatCopyMessage } from "../../src/modules/copy/notifier";

test("formatCopyMessage prefers the structured fallback message", () => {
  assert.equal(
    formatCopyMessage({
      ok: true,
      format: "path-text",
      count: 1,
      outcome: "copied-path-text-fallback",
      message: "Install wl-clipboard to enable file copy on Wayland.",
    }),
    "Install wl-clipboard to enable file copy on Wayland.",
  );
});

test("formatCopyMessage returns dependency messages directly", () => {
  assert.equal(
    formatCopyMessage({
      ok: false,
      format: "none",
      count: 1,
      outcome: "dependency-missing",
      message: "macOS osascript is required to copy files.",
    }),
    "macOS osascript is required to copy files.",
  );
});
