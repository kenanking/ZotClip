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
    "File clipboard unavailable. Copied 2 attachment path(s) instead.",
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
