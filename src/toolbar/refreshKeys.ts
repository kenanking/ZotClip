import { buildLibraryRefreshKey } from "../modules/copy/interaction/context/libraryContext";
import { buildReaderRefreshKey } from "../modules/copy/interaction/readerContext";
import type {
  MainToolbarCopyButtonDeps,
  ReaderToolbarCopyButtonDeps,
} from "../modules/copy/toolbarButtonDeps";

export function buildSelectionRefreshKeyFromDeps(
  win: Window,
  deps: MainToolbarCopyButtonDeps,
): string {
  return buildLibraryRefreshKey({
    mode: deps.getMode(),
    allowedTypes: deps.getAllowedTypes(),
    items: deps.getSelectedItems(win),
  });
}

export function buildReaderRefreshKeyFromDeps(
  itemID: number | undefined,
  deps: ReaderToolbarCopyButtonDeps,
): string {
  return buildReaderRefreshKey(itemID, deps.getAllowedTypes());
}
