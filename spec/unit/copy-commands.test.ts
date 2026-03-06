import assert from "node:assert/strict";
import test from "node:test";

import {
  copyFromReader,
  copyFromSelection,
} from "../../src/modules/copy/copyCommands";

const sampleFiles = [
  {
    itemID: 1,
    attachmentID: 11,
    path: "C:/papers/a.pdf",
  },
];

test("copyFromSelection copies from current pane selection", async () => {
  let selectedCalled = false;
  let resolverAllowedTypes: string[] = [];
  let writerCalled = false;
  let fallbackEnabled = false;

  const result = await copyFromSelection("all", ["pdf", "epub"], {
    getSelectedItems: () => {
      selectedCalled = true;
      return [{ id: 1 } as Zotero.Item];
    },
    getCurrentReaderItemID: () => undefined,
    resolveFromItems: async (_items, _mode, allowedTypes) => {
      resolverAllowedTypes = allowedTypes;
      return sampleFiles;
    },
    resolveFromReader: async () => [],
    writeClipboard: async (_files, allowPathFallback) => {
      writerCalled = true;
      fallbackEnabled = allowPathFallback;
      return {
        ok: true,
        format: "file-object",
        count: 1,
      };
    },
  });

  assert.equal(selectedCalled, true);
  assert.deepEqual(resolverAllowedTypes, ["pdf", "epub"]);
  assert.equal(writerCalled, true);
  assert.equal(fallbackEnabled, true);
  assert.equal(result.ok, true);
});

test("copyFromReader copies from current reader item", async () => {
  let resolverAllowedTypes: string[] = [];
  let fallbackEnabled = false;

  const result = await copyFromReader(["pdf"], {
    getSelectedItems: () => [],
    getCurrentReaderItemID: () => 1001,
    resolveFromItems: async () => [],
    resolveFromReader: async (itemID, allowedTypes) => {
      if (itemID === 1001) {
        resolverAllowedTypes = allowedTypes;
      }
      return sampleFiles;
    },
    writeClipboard: async (_files, allowPathFallback) => {
      fallbackEnabled = allowPathFallback;
      return {
        ok: true,
        format: "file-object",
        count: 1,
      };
    },
  });

  assert.deepEqual(resolverAllowedTypes, ["pdf"]);
  assert.equal(fallbackEnabled, true);
  assert.equal(result.ok, true);
});
