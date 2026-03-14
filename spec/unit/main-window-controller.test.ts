import assert from "node:assert/strict";
import test from "node:test";

import { createMainWindowController } from "../../src/modules/copy/mainWindowController";
import { createReaderToolbarController } from "../../src/modules/copy/readerToolbarController";

function createWindowStub(): _ZoteroTypes.MainWindow {
  return {
    MozXULElement: {
      insertFTLIfNeeded: () => {},
    },
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as Document,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as _ZoteroTypes.MainWindow;
}

test("main window controller registers per-window handlers and disposes only the target window", () => {
  const firstWindow = createWindowStub();
  const secondWindow = createWindowStub();
  let readerHookRegistrations = 0;
  let selectionHookRegistrations = 0;
  let toolbarRegistrations = 0;
  let disposedFirst = 0;
  let disposedSecond = 0;

  const controller = createMainWindowController({
    insertLocale: () => {},
    getReaderShortcut: () => "Ctrl+Shift+C",
    getLibraryShortcut: () => "Ctrl+C",
    isMainToolbarButtonEnabled: () => true,
    registerReaderShortcutHandler: (win) => {
      readerHookRegistrations += 1;
      return () => {
        if (win === firstWindow) {
          disposedFirst += 1;
        } else {
          disposedSecond += 1;
        }
      };
    },
    registerSelectionShortcutHandler: (win) => {
      selectionHookRegistrations += 1;
      return () => {
        if (win === firstWindow) {
          disposedFirst += 1;
        } else {
          disposedSecond += 1;
        }
      };
    },
    registerMainToolbarCopyButton: (win) => {
      toolbarRegistrations += 1;
      return () => {
        if (win === firstWindow) {
          disposedFirst += 1;
        } else {
          disposedSecond += 1;
        }
      };
    },
  });

  controller.load(firstWindow);
  controller.load(secondWindow);
  controller.unload(firstWindow);

  assert.equal(readerHookRegistrations, 2);
  assert.equal(selectionHookRegistrations, 2);
  assert.equal(toolbarRegistrations, 2);
  assert.equal(disposedFirst, 3);
  assert.equal(disposedSecond, 0);
});

test("reader toolbar controller registers once and disposes when disabled", () => {
  let registrations = 0;
  let disposals = 0;

  const controller = createReaderToolbarController({
    isEnabled: () => true,
    registerReaderToolbarCopyButton: () => {
      registrations += 1;
      return () => {
        disposals += 1;
      };
    },
  });

  controller.sync();
  controller.sync();
  controller.setEnabled(false);

  assert.equal(registrations, 1);
  assert.equal(disposals, 1);
});
