interface ReaderTabsLike {
  selectedID?: string;
  selectedType?: string;
}

export function getCurrentReaderItemID(deps: {
  getTabs(): ReaderTabsLike | undefined;
  getReaderByTabID(tabID: string): { itemID?: number } | undefined;
}): number | undefined {
  const selectedID = deps.getTabs()?.selectedID;
  if (!selectedID) {
    return undefined;
  }

  return deps.getReaderByTabID(selectedID)?.itemID;
}

export function isReaderTabSelected(deps: {
  getTabs(): ReaderTabsLike | undefined;
}): boolean {
  return deps.getTabs()?.selectedType === "reader";
}

export function buildReaderRefreshKey(
  itemID: number | undefined,
  allowedTypes: string[],
): string {
  return [itemID || "none", allowedTypes.join(",")].join("|");
}
