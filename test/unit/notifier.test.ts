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
