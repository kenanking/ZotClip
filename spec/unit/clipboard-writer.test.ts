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

test("ClipboardWriter uses path-text directly on Windows", async () => {
  let nativeCalled = false;
  let uriCalled = false;
  let fallbackCalled = false;

  const result = await writeClipboard(
    [{ attachmentID: 1, itemID: 1, path: "C:/a.pdf" }],
    true,
    {
      isWindows: () => true,
      writeFileObject: async () => {
        nativeCalled = true;
        return true;
      },
      writeURIList: async () => {
        uriCalled = true;
        return true;
      },
      writePathText: () => {
        fallbackCalled = true;
        return true;
      },
    },
  );

  assert.equal(nativeCalled, false);
  assert.equal(uriCalled, false);
  assert.equal(fallbackCalled, true);
  assert.equal(result.ok, true);
  assert.equal(result.format, "path-text");
});

test("ClipboardWriter reports unsupported Windows file clipboard without fallback", async () => {
  const result = await writeClipboard(
    [{ attachmentID: 1, itemID: 1, path: "C:/a.pdf" }],
    false,
    {
      isWindows: () => true,
      writeFileObject: async () => {
        throw new Error("should not be called");
      },
      writeURIList: async () => {
        throw new Error("should not be called");
      },
      writePathText: () => {
        throw new Error("should not be called");
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.format, "none");
  assert.equal(
    result.message,
    "Windows file clipboard is unavailable in Zotero; enable path fallback to copy file paths instead.",
  );
});
