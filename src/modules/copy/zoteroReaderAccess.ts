import {
  getCurrentReaderItemID,
  isReaderTabSelected,
} from "./interaction/readerContext";

// Wired helpers that bind the pure DI functions from readerContext.ts
// to the Zotero runtime globals, eliminating repeated inline wiring.

function getZoteroTabs():
  { selectedID?: string; selectedType?: string } | undefined {
  return ztoolkit.getGlobal("Zotero_Tabs") as
    { selectedID?: string; selectedType?: string } | undefined;
}

export function getActiveReaderItemID(): number | undefined {
  return getCurrentReaderItemID({
    getTabs: getZoteroTabs,
    getReaderByTabID: (tabID) => Zotero.Reader.getByTabID(tabID),
  });
}

export function isActiveReaderTabSelected(): boolean {
  return isReaderTabSelected({ getTabs: getZoteroTabs });
}

/** Resolve the originating window before any asynchronous attachment lookup. */
export function getReaderItemIDForWindow(
  win: Window | null,
): number | undefined {
  if (!win) return undefined;
  const top = win.top;
  const tabs = (top as _ZoteroTypes.MainWindow | null)?.Zotero_Tabs;
  if (tabs) {
    return tabs.selectedType === "reader"
      ? Zotero.Reader.getByTabID(tabs.selectedID)?.itemID
      : undefined;
  }
  return Zotero.Reader._readers.find(
    (reader) => reader._iframeWindow?.top === top,
  )?.itemID;
}
