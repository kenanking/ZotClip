import assert from "node:assert/strict";
import test from "node:test";

import { formatCopyMessage } from "../../src/modules/copy/notifier";

test("notifier formats fallback message with count", () => {
  const message = formatCopyMessage({
    ok: true,
    format: "path-text",
    count: 2,
  });

  assert.equal(
    message,
    "File clipboard unavailable. Copied 2 file path(s) instead.",
  );
});

test("notifier prefers explicit failure message when provided", () => {
  const message = formatCopyMessage({
    ok: false,
    format: "none",
    count: 1,
    message:
      "Windows file clipboard is unavailable in Zotero; enable path fallback to copy file paths instead.",
  });

  assert.equal(
    message,
    "Windows file clipboard is unavailable in Zotero; enable path fallback to copy file paths instead.",
  );
});
