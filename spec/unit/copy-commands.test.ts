import assert from "node:assert/strict";
import test from "node:test";

import { copyFromReaderPath } from "../../src/modules/copy/copyPathCommands";

test("copyFromReaderPath returns an explicit path-copy result instead of fallback wording", async () => {
  const result = await copyFromReaderPath(["pdf"], {
    getCurrentReaderItemID: () => 2048,
    resolveFromReader: async () => [
      {
        itemID: 2048,
        attachmentID: 99,
        path: "/tmp/file.pdf",
      },
    ],
    writePathText: (value) => value === "/tmp/file.pdf",
  });

  assert.deepEqual(result, {
    ok: true,
    format: "path-text",
    count: 1,
    outcome: "copied-path-text-explicit",
    messageKey: "copy-path-text-explicit",
  });
});

test("copyFromReaderPath returns a reader-unavailable result when there is no active reader", async () => {
  const result = await copyFromReaderPath(["pdf"], {
    getCurrentReaderItemID: () => undefined,
    resolveFromReader: async () => [],
    writePathText: () => true,
  });

  assert.deepEqual(result, {
    ok: false,
    format: "none",
    count: 0,
    messageKey: "copy-reader-no-active",
  });
});

test("copyFromReaderPath returns no-files when the reader attachment cannot be resolved", async () => {
  const result = await copyFromReaderPath(["pdf"], {
    getCurrentReaderItemID: () => 2048,
    resolveFromReader: async () => [],
    writePathText: () => true,
  });

  assert.deepEqual(result, {
    ok: false,
    format: "none",
    count: 0,
    outcome: "backend-unavailable",
    messageKey: "copy-no-files",
  });
});

test("copyFromReaderPath returns a clipboard-write failure when plain-text copy fails", async () => {
  const result = await copyFromReaderPath(["pdf"], {
    getCurrentReaderItemID: () => 2048,
    resolveFromReader: async () => [
      {
        itemID: 2048,
        attachmentID: 99,
        path: "/tmp/file.pdf",
      },
    ],
    writePathText: () => false,
  });

  assert.deepEqual(result, {
    ok: false,
    format: "none",
    count: 0,
    outcome: "copy-failed",
    messageKey: "copy-clipboard-write-failed",
  });
});
