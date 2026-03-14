import assert from "node:assert/strict";
import test from "node:test";

import { createCopyService } from "../../src/modules/copy/copyService";

const sampleResolvedAttachment = {
  itemID: 1,
  attachmentID: 11,
  path: "/tmp/paper.pdf",
};

const successResult = {
  ok: true,
  format: "file-object" as const,
  count: 1,
  outcome: "copied-files" as const,
};

test("CopyService copies the current library selection with current settings", async () => {
  let receivedItems: Zotero.Item[] = [];
  let receivedMode: "all" | "primary" = "primary";
  let receivedAllowedTypes: string[] = [];
  let receivedSource = "";

  const service = createCopyService({
    getSettings: () => ({
      allowedTypes: ["pdf"],
      multiAttachmentMode: "all",
    }),
    getSelectedItems: () => [{ id: 1 } as Zotero.Item],
    getCurrentReaderItemID: () => undefined,
    resolveFromItems: async (items, mode, allowedTypes) => {
      receivedItems = items;
      receivedMode = mode;
      receivedAllowedTypes = allowedTypes;
      return [sampleResolvedAttachment];
    },
    resolveFromReader: async () => [],
    writeClipboard: async (_files, source) => {
      receivedSource = source;
      return successResult;
    },
    getClipboardDiagnostics: async () => ({
      platform: "linux",
      linuxSession: "x11",
      commands: {},
      activeBackend: "linux-gtk4-helper",
      lines: [],
    }),
  });

  const result = await service.copySelection();

  assert.equal(receivedItems.length, 1);
  assert.equal(receivedMode, "all");
  assert.deepEqual(receivedAllowedTypes, ["pdf"]);
  assert.equal(receivedSource, "library");
  assert.deepEqual(result, successResult);
});

test("CopyService copies the current reader item with current settings", async () => {
  let resolvedItemID: number | undefined;
  let receivedAllowedTypes: string[] = [];
  let receivedSource = "";

  const service = createCopyService({
    getSettings: () => ({
      allowedTypes: ["epub"],
      multiAttachmentMode: "primary",
    }),
    getSelectedItems: () => [],
    getCurrentReaderItemID: () => 42,
    resolveFromItems: async () => [],
    resolveFromReader: async (itemID, allowedTypes) => {
      resolvedItemID = itemID;
      receivedAllowedTypes = allowedTypes;
      return [sampleResolvedAttachment];
    },
    writeClipboard: async (_files, source) => {
      receivedSource = source;
      return successResult;
    },
    getClipboardDiagnostics: async () => ({
      platform: "macos",
      commands: {},
      activeBackend: "macos-osascript-file-list",
      lines: [],
    }),
  });

  const result = await service.copyReader();

  assert.equal(resolvedItemID, 42);
  assert.deepEqual(receivedAllowedTypes, ["epub"]);
  assert.equal(receivedSource, "reader");
  assert.deepEqual(result, successResult);
});

test("CopyService reports reader availability when there is no active reader item", async () => {
  const service = createCopyService({
    getSettings: () => ({
      allowedTypes: ["pdf"],
      multiAttachmentMode: "all",
    }),
    getSelectedItems: () => [],
    getCurrentReaderItemID: () => undefined,
    resolveFromItems: async () => [],
    resolveFromReader: async () => [],
    writeClipboard: async () => successResult,
    getClipboardDiagnostics: async () => ({
      platform: "windows",
      commands: {},
      activeBackend: "windows-native",
      lines: [],
    }),
  });

  assert.deepEqual(await service.getReaderAvailability(), {
    canCopy: false,
    messageKey: "copy-reader-no-active",
  });
});

test("CopyService reports library availability from resolved files", async () => {
  const service = createCopyService({
    getSettings: () => ({
      allowedTypes: ["pdf"],
      multiAttachmentMode: "all",
    }),
    getSelectedItems: () => [{ id: 1 } as Zotero.Item],
    getCurrentReaderItemID: () => undefined,
    resolveFromItems: async () => [sampleResolvedAttachment],
    resolveFromReader: async () => [],
    writeClipboard: async () => successResult,
    getClipboardDiagnostics: async () => ({
      platform: "linux",
      linuxSession: "wayland",
      commands: { "wl-copy": true },
      activeBackend: "linux-wayland-wl-copy-uri-list",
      lines: [],
    }),
  });

  assert.deepEqual(await service.getSelectionAvailability(), {
    canCopy: true,
  });
});

test("CopyService returns clipboard diagnostics from the runtime adapter", async () => {
  const diagnostics = {
    platform: "linux" as const,
    linuxSession: "unknown" as const,
    commands: {
      "gtk4-helper": false,
      "wl-copy": true,
    },
    activeBackend: "linux-wayland-wl-copy-uri-list",
    lines: [
      {
        key: "copy-diagnostics-active-backend" as const,
        args: { backend: "linux-wayland-wl-copy-uri-list" },
      },
    ],
  };

  const service = createCopyService({
    getSettings: () => ({
      allowedTypes: ["pdf"],
      multiAttachmentMode: "all",
    }),
    getSelectedItems: () => [],
    getCurrentReaderItemID: () => undefined,
    resolveFromItems: async () => [],
    resolveFromReader: async () => [],
    writeClipboard: async () => successResult,
    getClipboardDiagnostics: async () => diagnostics,
  });

  assert.deepEqual(await service.getClipboardDiagnostics(), diagnostics);
});
