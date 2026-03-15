export function getSelectedLibraryItems(deps: {
  getActivePane(): { getSelectedItems?(): Zotero.Item[] } | undefined;
}): Zotero.Item[] {
  return (deps.getActivePane()?.getSelectedItems?.() || []) as Zotero.Item[];
}

export function buildLibraryRefreshKey(input: {
  mode: "all" | "primary";
  allowedTypes: string[];
  items: Zotero.Item[];
}): string {
  return [
    input.mode,
    input.allowedTypes.join(","),
    input.items.map((item) => item.id).join(","),
  ].join("|");
}
