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
  let writerSource = "";

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
    writeClipboard: async (_files, source) => {
      writerCalled = true;
      writerSource = source;
      return {
        ok: true,
        format: "file-object",
        count: 1,
        outcome: "copied-files",
      };
    },
  });

  assert.equal(selectedCalled, true);
  assert.deepEqual(resolverAllowedTypes, ["pdf", "epub"]);
  assert.equal(writerCalled, true);
  assert.equal(writerSource, "library");
  assert.equal(result.ok, true);
});

test("copyFromReader copies from current reader item", async () => {
  let resolverAllowedTypes: string[] = [];
  let writerSource = "";

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
    writeClipboard: async (_files, source) => {
      writerSource = source;
      return {
        ok: true,
        format: "file-object",
        count: 1,
        outcome: "copied-files",
      };
    },
  });

  assert.deepEqual(resolverAllowedTypes, ["pdf"]);
  assert.equal(writerSource, "reader");
  assert.equal(result.ok, true);
});

test("copyFromReader returns a failure result when no reader tab is active", async () => {
  const result = await copyFromReader(["pdf"], {
    getSelectedItems: () => [],
    getCurrentReaderItemID: () => undefined,
    resolveFromItems: async () => [],
    resolveFromReader: async () => sampleFiles,
    writeClipboard: async () => ({
      ok: true,
      format: "file-object",
      count: 1,
      outcome: "copied-files",
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    format: "none",
    count: 0,
    message: "No active reader attachment.",
  });
});
