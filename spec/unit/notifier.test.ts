import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCopyMessage,
  getCopyResultNotificationType,
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

  assert.equal(
    message,
    "Windows file clipboard is unavailable in Zotero.",
  );
});
