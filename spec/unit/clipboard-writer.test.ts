import assert from "node:assert/strict";
import test from "node:test";

import { writeClipboard } from "../../src/modules/copy/clipboardWriter";

test("ClipboardWriter returns backend-unavailable when there are no files to copy", async () => {
  const result = await writeClipboard([], "library", {
    detectPlatformContext: () => ({ platform: "windows" }),
    writeFileObject: async () => false,
    writeURIList: async () => false,
    writePathText: () => false,
  });

  assert.deepEqual(result, {
    ok: false,
    format: "none",
    count: 0,
    outcome: "backend-unavailable",
    message: "No files to copy.",
  });
});

test("ClipboardWriter uses the Windows-native backend before other backends", async () => {
  let windowsCalled = false;
  let fileObjectCalled = false;
  let uriCalled = false;
  let fallbackCalled = false;

  const result = await writeClipboard(
    [
      { attachmentID: 1, itemID: 1, path: "C:/a.pdf" },
      { attachmentID: 2, itemID: 1, path: "C:/b.pdf" },
    ],
    "library",
    {
      detectPlatformContext: () => ({ platform: "windows" }),
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
  assert.equal(result.outcome, "copied-files");
});

test("ClipboardWriter falls back to path-text when non-Windows backends fail", async () => {
  let fileObjectCalled = false;
  let uriCalled = false;
  let fallbackCalled = false;

  const result = await writeClipboard(
    [{ attachmentID: 1, itemID: 1, path: "C:/a.pdf" }],
    "reader",
    {
      detectPlatformContext: () => ({ platform: "linux", linuxSession: "x11" }),
      writeFileObject: async () => {
        fileObjectCalled = true;
        return false;
      },
      writeURIList: async () => {
        uriCalled = true;
        return false;
      },
      writePathText: (value) => {
        fallbackCalled = value === "C:/a.pdf";
        return true;
      },
    },
  );

  assert.equal(fileObjectCalled, true);
  assert.equal(uriCalled, true);
  assert.equal(fallbackCalled, true);
  assert.equal(result.ok, true);
  assert.equal(result.format, "path-text");
  assert.equal(result.count, 1);
  assert.equal(result.outcome, "copied-path-text-fallback");
});
