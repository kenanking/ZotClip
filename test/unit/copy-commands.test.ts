import assert from "node:assert/strict";
import test from "node:test";

import { copyFromReader, copyFromSelection } from "../../src/modules/copy/copyCommands";

const sampleFiles = [
  {
    itemID: 1,
    attachmentID: 11,
    path: "C:/papers/a.pdf",
  },
];

test("copyFromSelection copies from current pane selection", async () => {
  let selectedCalled = false;
  let resolverCalled = false;
  let writerCalled = false;

  const result = await copyFromSelection("all", true, {
    getSelectedItems: () => {
      selectedCalled = true;
      return [{ id: 1 } as Zotero.Item];
    },
    getCurrentReaderItemID: () => undefined,
    resolveFromItems: async () => {
      resolverCalled = true;
      return sampleFiles;
    },
    resolveFromReader: async () => [],
    writeClipboard: async () => {
      writerCalled = true;
      return {
        ok: true,
        format: "file-object",
        count: 1,
      };
    },
  });

  assert.equal(selectedCalled, true);
  assert.equal(resolverCalled, true);
  assert.equal(writerCalled, true);
  assert.equal(result.ok, true);
});

test("copyFromReader copies from current reader item", async () => {
  let readerCalled = false;

  const result = await copyFromReader(true, {
    getSelectedItems: () => [],
    getCurrentReaderItemID: () => 1001,
    resolveFromItems: async () => [],
    resolveFromReader: async (itemID) => {
      readerCalled = itemID === 1001;
      return sampleFiles;
    },
    writeClipboard: async () => ({
      ok: true,
      format: "file-object",
      count: 1,
    }),
  });

  assert.equal(readerCalled, true);
  assert.equal(result.ok, true);
});
