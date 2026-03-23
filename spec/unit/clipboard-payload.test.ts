import assert from "node:assert/strict";
import test from "node:test";

import { buildClipboardPayload } from "../../src/modules/copy/clipboard/payload";

test("buildClipboardPayload returns unique paths, file URIs, and path text", () => {
  const payload = buildClipboardPayload(
    [
      { itemID: 1, attachmentID: 11, path: "C:\\Docs\\a.pdf" },
      { itemID: 1, attachmentID: 12, path: "C:\\Docs\\a.pdf" },
      { itemID: 2, attachmentID: 13, path: "/home/user/book.epub" },
    ],
    "library",
  );

  assert.deepEqual(payload.paths, ["C:\\Docs\\a.pdf", "/home/user/book.epub"]);
  assert.deepEqual(payload.fileUris, [
    "file:///C:/Docs/a.pdf",
    "file:///home/user/book.epub",
  ]);
  assert.equal(payload.pathText, "C:\\Docs\\a.pdf\n/home/user/book.epub");
  assert.equal(payload.operation, "copy");
  assert.equal(payload.source, "library");
});

test("buildClipboardPayload encodes # and special characters in file URIs", () => {
  const payload = buildClipboardPayload(
    [
      { itemID: 1, attachmentID: 11, path: "/home/user/Smith #1.pdf" },
      {
        itemID: 2,
        attachmentID: 12,
        path: "C:\\Docs\\Q&A (draft).pdf",
      },
    ],
    "library",
  );

  assert.deepEqual(payload.fileUris, [
    "file:///home/user/Smith%20%231.pdf",
    "file:///C:/Docs/Q%26A%20(draft).pdf",
  ]);
});

test("buildClipboardPayload prefers clipboardPath over the original path", () => {
  const payload = buildClipboardPayload(
    [
      {
        itemID: 1,
        attachmentID: 11,
        path: "/src/a/paper.pdf",
        clipboardPath: "/tmp/zotclip-copy/paper.pdf",
      },
    ],
    "library",
  );

  assert.deepEqual(payload.paths, ["/tmp/zotclip-copy/paper.pdf"]);
  assert.deepEqual(payload.fileUris, ["file:///tmp/zotclip-copy/paper.pdf"]);
  assert.equal(payload.pathText, "/tmp/zotclip-copy/paper.pdf");
});
