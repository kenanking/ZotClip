import assert from "node:assert/strict";
import test from "node:test";

import { writeClipboard } from "../../src/modules/copy/clipboardWriter";

test("ClipboardWriter returns file-object when native write succeeds", async () => {
  const result = await writeClipboard(
    [{ attachmentID: 1, itemID: 1, path: "C:/a.pdf" }],
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

test("ClipboardWriter uses native Windows clipboard before other strategies", async () => {
  let windowsCalled = false;
  let fileObjectCalled = false;
  let uriCalled = false;
  let fallbackCalled = false;

  const result = await writeClipboard(
    [
      { attachmentID: 1, itemID: 1, path: "C:/a.pdf" },
      { attachmentID: 2, itemID: 1, path: "C:/b.pdf" },
    ],
    {
      isWindows: () => true,
      writeWindowsFileDrop: async () => {
        windowsCalled = true;
        return true;
      },
      writeFileObject: async () => {
        fileObjectCalled = true;
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

  assert.equal(windowsCalled, true);
  assert.equal(fileObjectCalled, false);
  assert.equal(uriCalled, false);
  assert.equal(fallbackCalled, false);
  assert.equal(result.ok, true);
  assert.equal(result.format, "file-object");
  assert.equal(result.count, 2);
});

test("ClipboardWriter falls back to path-text when native write fails", async () => {
  let fallbackCalled = false;
  const result = await writeClipboard(
    [{ attachmentID: 1, itemID: 1, path: "C:/a.pdf" }],
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

test("ClipboardWriter falls back to path-text when native Windows clipboard write fails", async () => {
  let windowsCalled = false;
  let fileObjectCalled = false;
  let uriCalled = false;
  let fallbackCalled = false;

  const result = await writeClipboard(
    [
      { attachmentID: 1, itemID: 1, path: "C:/a.pdf" },
      { attachmentID: 2, itemID: 1, path: "C:/b.pdf" },
    ],
    {
      isWindows: () => true,
      writeWindowsFileDrop: async () => {
        windowsCalled = true;
        return false;
      },
      writeFileObject: async () => {
        fileObjectCalled = true;
        return false;
      },
      writeURIList: async () => {
        uriCalled = true;
        return false;
      },
      writePathText: () => {
        fallbackCalled = true;
        return true;
      },
    },
  );

  assert.equal(windowsCalled, true);
  assert.equal(fileObjectCalled, false);
  assert.equal(uriCalled, false);
  assert.equal(fallbackCalled, true);
  assert.equal(result.ok, true);
  assert.equal(result.format, "path-text");
  assert.equal(result.count, 2);
});
