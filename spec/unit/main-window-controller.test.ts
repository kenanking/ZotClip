import assert from "node:assert/strict";
import test from "node:test";

import { createMainWindowController } from "../../src/modules/copy/mainWindowController";
import { createReaderToolbarController } from "../../src/modules/copy/readerToolbarController";

function createWindowStub(): _ZoteroTypes.MainWindow {
  return {
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as Document,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as _ZoteroTypes.MainWindow;
}

test("main window controller registers toolbar state per window and disposes only the target window", () => {
  const firstWindow = createWindowStub();
  const secondWindow = createWindowStub();
  let toolbarRegistrations = 0;
  let disposedFirst = 0;
  let disposedSecond = 0;

  const controller = createMainWindowController({
    isMainToolbarButtonEnabled: () => true,
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

  assert.equal(toolbarRegistrations, 2);
  assert.equal(disposedFirst, 1);
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
