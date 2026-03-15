import assert from "node:assert/strict";
import test from "node:test";

import {
  copyFromReaderItem,
  copyFromReader,
  copyFromSelection,
} from "../../src/modules/copy/copyCommands";
import { copyFromReaderPath } from "../../src/modules/copy/copyPathCommands";

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

test("copyFromReaderItem copies from an explicit reader item id", async () => {
  let resolvedItemID: number | undefined;
  let writerSource = "";

  const result = await copyFromReaderItem(2048, ["pdf"], {
    getSelectedItems: () => [],
    getCurrentReaderItemID: () => undefined,
    resolveFromItems: async () => [],
    resolveFromReader: async (itemID) => {
      resolvedItemID = itemID;
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

  assert.equal(resolvedItemID, 2048);
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
    messageKey: "copy-reader-no-active",
  });
});

test("copyFromReaderItem returns a failure result when no reader item id is provided", async () => {
  const result = await copyFromReaderItem(undefined, ["pdf"], {
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
    messageKey: "copy-reader-no-active",
  });
});

test("copyFromReaderPath returns an explicit path-copy result instead of fallback wording", async () => {
  const result = await copyFromReaderPath(["pdf"], {
    getCurrentReaderItemID: () => 2048,
    resolveFromReader: async () => [
      {
        itemID: 2048,
        attachmentID: 99,
        path: "/tmp/file.pdf",
      },
    ],
    writePathText: (value) => value === "/tmp/file.pdf",
  });

  assert.deepEqual(result, {
    ok: true,
    format: "path-text",
    count: 1,
    outcome: "copied-path-text-explicit",
    messageKey: "copy-path-text-explicit",
  });
});
