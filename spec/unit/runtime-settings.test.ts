import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeSettingsStore } from "../../src/modules/copy/runtime/runtimeSettings";

test("runtime settings store caches a normalized snapshot until invalidated", () => {
  let allowedTypesCalls = 0;
  let parseShortcutCalls = 0;

  const store = createRuntimeSettingsStore({
    getAllowedTypes: () => {
      allowedTypesCalls += 1;
      return ["pdf", "epub"];
    },
    getMultiAttachmentMode: () => "primary",
    getLibraryShortcut: () => "Ctrl+Shift+C",
    getReaderShortcut: () => "Alt+C",
    getMainToolbarButtonEnabled: () => true,
    getReaderToolbarButtonEnabled: () => false,
    parseShortcut: (value) => {
      parseShortcutCalls += 1;
      return { ctrlOrMeta: false, alt: false, shift: false, key: value };
    },
  });

  const firstSnapshot = store.getSnapshot();
  const secondSnapshot = store.getSnapshot();

  assert.equal(firstSnapshot, secondSnapshot);
  assert.equal(allowedTypesCalls, 1);
  assert.equal(parseShortcutCalls, 2);
  assert.deepEqual(firstSnapshot.allowedTypes, ["pdf", "epub"]);
  assert.equal(firstSnapshot.multiAttachmentMode, "primary");
  assert.equal(firstSnapshot.libraryShortcut, "Ctrl+Shift+C");
  assert.equal(firstSnapshot.readerShortcut, "Alt+C");
  assert.equal(firstSnapshot.showMainToolbarButton, true);
  assert.equal(firstSnapshot.showReaderToolbarButton, false);
  assert.deepEqual(firstSnapshot.parsedLibraryShortcut, {
    ctrlOrMeta: false,
    alt: false,
    shift: false,
    key: "Ctrl+Shift+C",
  });
  assert.deepEqual(firstSnapshot.parsedReaderShortcut, {
    ctrlOrMeta: false,
    alt: false,
    shift: false,
    key: "Alt+C",
  });
});

test("runtime settings store rebuilds the snapshot after invalidation", () => {
  let allowedTypesCalls = 0;
  let currentLibraryShortcut = "Ctrl+C";

  const store = createRuntimeSettingsStore({
    getAllowedTypes: () => {
      allowedTypesCalls += 1;
      return allowedTypesCalls === 1 ? ["pdf"] : ["epub"];
    },
    getMultiAttachmentMode: () => "all",
    getLibraryShortcut: () => currentLibraryShortcut,
    getReaderShortcut: () => "",
    getMainToolbarButtonEnabled: () => true,
    getReaderToolbarButtonEnabled: () => true,
    parseShortcut: (value) =>
      value
        ? {
            ctrlOrMeta: value.includes("Ctrl"),
            alt: false,
            shift: false,
            key: value.split("+").pop() || "",
          }
        : undefined,
  });

  const firstSnapshot = store.getSnapshot();
  currentLibraryShortcut = "Ctrl+Shift+C";
  store.invalidate();
  const secondSnapshot = store.getSnapshot();

  assert.notEqual(firstSnapshot, secondSnapshot);
  assert.equal(allowedTypesCalls, 2);
  assert.deepEqual(firstSnapshot.allowedTypes, ["pdf"]);
  assert.deepEqual(secondSnapshot.allowedTypes, ["epub"]);
  assert.equal(secondSnapshot.libraryShortcut, "Ctrl+Shift+C");
  assert.deepEqual(secondSnapshot.parsedLibraryShortcut, {
    ctrlOrMeta: true,
    alt: false,
    shift: false,
    key: "C",
  });
});

test("runtime settings store preserves empty parsed shortcuts", () => {
  const store = createRuntimeSettingsStore({
    getAllowedTypes: () => ["pdf"],
    getMultiAttachmentMode: () => "all",
    getLibraryShortcut: () => "Ctrl+C",
    getReaderShortcut: () => "",
    getMainToolbarButtonEnabled: () => true,
    getReaderToolbarButtonEnabled: () => true,
    parseShortcut: (value) =>
      value
        ? { ctrlOrMeta: true, alt: false, shift: false, key: "c" }
        : undefined,
  });

  const snapshot = store.getSnapshot();

  assert.equal(snapshot.readerShortcut, "");
  assert.equal(snapshot.parsedReaderShortcut, undefined);
});
