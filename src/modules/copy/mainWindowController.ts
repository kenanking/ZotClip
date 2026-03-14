export interface MainWindowControllerDeps {
  insertLocale(win: _ZoteroTypes.MainWindow): void;
  isMainToolbarButtonEnabled(): boolean;
  registerReaderShortcutHandler(win: _ZoteroTypes.MainWindow): () => void;
  registerSelectionShortcutHandler(win: _ZoteroTypes.MainWindow): () => void;
  registerMainToolbarCopyButton(win: _ZoteroTypes.MainWindow): () => void;
}

export interface MainWindowController {
  load(win: _ZoteroTypes.MainWindow): void;
  unload(win: Window): void;
  syncMainToolbarButtons(wins: _ZoteroTypes.MainWindow[]): void;
  disposeAll(wins: Window[]): void;
}

export function createMainWindowController(
  deps: MainWindowControllerDeps,
): MainWindowController {
  const readerHookDisposers = new WeakMap<Window, () => void>();
  const selectionHookDisposers = new WeakMap<Window, () => void>();
  const mainToolbarDisposers = new WeakMap<Window, () => void>();

  return {
    load(win): void {
      deps.insertLocale(win);

      readerHookDisposers.set(win, deps.registerReaderShortcutHandler(win));
      selectionHookDisposers.set(
        win,
        deps.registerSelectionShortcutHandler(win),
      );

      if (deps.isMainToolbarButtonEnabled()) {
        mainToolbarDisposers.set(win, deps.registerMainToolbarCopyButton(win));
      }
    },

    unload(win): void {
      disposeForWindow(readerHookDisposers, win);
      disposeForWindow(selectionHookDisposers, win);
      disposeForWindow(mainToolbarDisposers, win);
    },

    syncMainToolbarButtons(wins): void {
      const enabled = deps.isMainToolbarButtonEnabled();

      for (const win of wins) {
        const existing = mainToolbarDisposers.get(win);
        if (enabled && !existing) {
          mainToolbarDisposers.set(win, deps.registerMainToolbarCopyButton(win));
          continue;
        }

        if (!enabled && existing) {
          existing();
          mainToolbarDisposers.delete(win);
        }
      }
    },

    disposeAll(wins): void {
      for (const win of wins) {
        disposeForWindow(readerHookDisposers, win);
        disposeForWindow(selectionHookDisposers, win);
        disposeForWindow(mainToolbarDisposers, win);
      }
    },
  };
}

function disposeForWindow(
  disposers: WeakMap<Window, () => void>,
  win: Window,
): void {
  disposers.get(win)?.();
  disposers.delete(win);
}
