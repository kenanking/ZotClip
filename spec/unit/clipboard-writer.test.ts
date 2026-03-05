import assert from "node:assert/strict";
import test from "node:test";

import { writeClipboard } from "../../src/modules/copy/clipboardWriter";

test("ClipboardWriter returns file-object when native write succeeds", async () => {
  const result = await writeClipboard(
    [{ attachmentID: 1, itemID: 1, path: "C:/a.pdf" }],
    true,
    {
      writeFileObject: async () => true,
      writeURIList: async () => false,
      writePathText: () => false,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.format, "file-object");
  assert.equal(result.count, 1);
});

test("ClipboardWriter falls back to path-text when native write fails", async () => {
  let fallbackCalled = false;
  const result = await writeClipboard(
    [{ attachmentID: 1, itemID: 1, path: "C:/a.pdf" }],
    true,
    {
      writeFileObject: async () => false,
      writeURIList: async () => false,
      writePathText: () => {
        fallbackCalled = true;
        return true;
      },
    },
  );

  assert.equal(fallbackCalled, true);
  assert.equal(result.ok, true);
  assert.equal(result.format, "path-text");
  assert.equal(result.count, 1);
});
