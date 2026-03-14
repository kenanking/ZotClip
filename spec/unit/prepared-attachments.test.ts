import assert from "node:assert/strict";
import test from "node:test";

import { prepareResolvedAttachments } from "../../src/modules/copy/preparedAttachments";

test("prepareResolvedAttachments keeps the first duplicate name and suffixes later duplicates", async () => {
  const copied: Array<{ from: string; to: string }> = [];

  const prepared = await prepareResolvedAttachments(
    [
      { itemID: 1, attachmentID: 11, path: "/src/a/paper.pdf" },
      { itemID: 1, attachmentID: 12, path: "/src/b/paper.pdf" },
      { itemID: 1, attachmentID: 13, path: "/src/c/paper.pdf" },
    ],
    {
      createOperationTempDir: async () => "/tmp/zotclip-op",
      copyFile: async (from, to) => copied.push({ from, to }),
      getBaseName: (path) => path.split("/").pop() || "",
      joinPath: (...parts) => parts.join("/"),
    },
  );

  assert.deepEqual(
    prepared.map((file) => file.clipboardPath),
    [
      "/src/a/paper.pdf",
      "/tmp/zotclip-op/paper_1.pdf",
      "/tmp/zotclip-op/paper_2.pdf",
    ],
  );
  assert.deepEqual(copied, [
    { from: "/src/b/paper.pdf", to: "/tmp/zotclip-op/paper_1.pdf" },
    { from: "/src/c/paper.pdf", to: "/tmp/zotclip-op/paper_2.pdf" },
  ]);
});

test("prepareResolvedAttachments ignores duplicates when extensions differ", async () => {
  const copied: Array<{ from: string; to: string }> = [];

  const prepared = await prepareResolvedAttachments(
    [
      { itemID: 1, attachmentID: 21, path: "/src/a/paper.pdf" },
      { itemID: 1, attachmentID: 22, path: "/src/b/paper.epub" },
    ],
    {
      createOperationTempDir: async () => {
        throw new Error("temp dir should not be created without duplicates");
      },
      copyFile: async (from, to) => copied.push({ from, to }),
      getBaseName: (path) => path.split("/").pop() || "",
      joinPath: (...parts) => parts.join("/"),
    },
  );

  assert.deepEqual(
    prepared.map((file) => file.clipboardPath),
    ["/src/a/paper.pdf", "/src/b/paper.epub"],
  );
  assert.deepEqual(copied, []);
});
