import assert from "node:assert/strict";
import test from "node:test";

import { prepareResolvedAttachments } from "../../src/modules/copy/preparedAttachments";

function createDeferred(): {
  promise: Promise<void>;
  resolve(): void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

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

test("prepareResolvedAttachments can start duplicate copies concurrently while preserving output order", async () => {
  const firstCopy = createDeferred();
  const secondCopy = createDeferred();
  let startedCopies = 0;
  let tempDirCalls = 0;

  const preparePromise = prepareResolvedAttachments(
    [
      { itemID: 1, attachmentID: 31, path: "/src/a/paper.pdf" },
      { itemID: 1, attachmentID: 32, path: "/src/b/paper.pdf" },
      { itemID: 1, attachmentID: 33, path: "/src/c/paper.pdf" },
    ],
    {
      createOperationTempDir: async () => {
        tempDirCalls += 1;
        return "/tmp/zotclip-op";
      },
      copyFile: async (_from, to) => {
        startedCopies += 1;
        if (to.endsWith("_1.pdf")) {
          await firstCopy.promise;
          return;
        }

        await secondCopy.promise;
      },
      getBaseName: (path) => path.split("/").pop() || "",
      joinPath: (...parts) => parts.join("/"),
    },
  );

  await Promise.resolve();
  assert.equal(tempDirCalls, 1);
  assert.equal(startedCopies, 2);

  secondCopy.resolve();
  firstCopy.resolve();
  const prepared = await preparePromise;

  assert.deepEqual(
    prepared.map((file) => file.clipboardPath),
    [
      "/src/a/paper.pdf",
      "/tmp/zotclip-op/paper_1.pdf",
      "/tmp/zotclip-op/paper_2.pdf",
    ],
  );
});
