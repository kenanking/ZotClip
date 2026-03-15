import assert from "node:assert/strict";
import test from "node:test";

import { getCopyNotificationOptions } from "../../src/modules/copy/notifier";

test("copy notifier keeps fallback notifications visible longer", () => {
  assert.deepEqual(
    getCopyNotificationOptions({
      ok: true,
      format: "path-text",
      count: 1,
      outcome: "copied-path-text-fallback",
      messageKey: "copy-path-text-fallback",
    }),
    {
      closeTime: 7000,
    },
  );
});

test("copy notifier uses the default duration for regular file-copy success", () => {
  assert.deepEqual(
    getCopyNotificationOptions({
      ok: true,
      format: "file-object",
      count: 1,
      outcome: "copied-files",
    }),
    {
      closeTime: 5000,
    },
  );
});
