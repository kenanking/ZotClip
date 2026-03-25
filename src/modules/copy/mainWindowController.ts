export interface MainWindowControllerDeps {
  isMainToolbarButtonEnabled(): boolean;
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
  const mainToolbarDisposers = new WeakMap<Window, () => void>();

  return {
    load(win): void {
      if (deps.isMainToolbarButtonEnabled()) {
        mainToolbarDisposers.set(win, deps.registerMainToolbarCopyButton(win));
      }
    },

    unload(win): void {
      disposeForWindow(mainToolbarDisposers, win);
    },

    syncMainToolbarButtons(wins): void {
      const enabled = deps.isMainToolbarButtonEnabled();

      for (const win of wins) {
        const existing = mainToolbarDisposers.get(win);
        if (enabled && !existing) {
          mainToolbarDisposers.set(
            win,
            deps.registerMainToolbarCopyButton(win),
          );
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
