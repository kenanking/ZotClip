import {
  createMainToolbarActionState,
  createReaderToolbarActionState,
} from "../modules/copy/actionStateFactory";
import type {
  MainToolbarCopyButtonDeps,
  ReaderToolbarCopyButtonDeps,
} from "../modules/copy/toolbarButtonDeps";
import { createDebouncedCallback } from "../utils/debouncedCallback";
import {
  buildReaderRefreshKeyFromDeps,
  buildSelectionRefreshKeyFromDeps,
} from "./refreshKeys";

const MAIN_TOOLBAR_REFRESH_DEBOUNCE_MS = 100;

export function registerMainToolbarCopyButton(
  win: Window,
  deps: MainToolbarCopyButtonDeps,
): () => void {
  if (!deps.isEnabled()) {
    return () => {};
  }

  const buttonHandle = deps.mountButton(win.document, {
    getLabel: () => deps.getLabel(),
    getRefreshKey: () => buildSelectionRefreshKeyFromDeps(win, deps),
    getActionState: deps.getActionState
      ? deps.getActionState
      : async () => createMainToolbarActionState(win, deps),
  });

  const requestRefresh = () => {
    void buttonHandle.refresh();
  };
  const debouncedRefresh = createDebouncedCallback(
    requestRefresh,
    MAIN_TOOLBAR_REFRESH_DEBOUNCE_MS,
  );

  win.addEventListener("focus", debouncedRefresh.trigger, true);
  win.addEventListener("mouseup", debouncedRefresh.trigger, true);
  win.addEventListener("keyup", debouncedRefresh.trigger, true);
  void buttonHandle.refresh();

  return () => {
    win.removeEventListener("focus", debouncedRefresh.trigger, true);
    win.removeEventListener("mouseup", debouncedRefresh.trigger, true);
    win.removeEventListener("keyup", debouncedRefresh.trigger, true);
    debouncedRefresh.cancel();
    buttonHandle.dispose();
  };
}

export function registerReaderToolbarCopyButton(
  deps: ReaderToolbarCopyButtonDeps,
): () => void {
  if (!deps.isEnabled()) {
    return () => {};
  }

  return deps.registerButton({
    getLabel: () => deps.getLabel(),
    getRefreshKey: (itemID) => buildReaderRefreshKeyFromDeps(itemID, deps),
    getActionState: deps.getActionState
      ? deps.getActionState
      : async (itemID) => createReaderToolbarActionState(itemID, deps),
  });
}
