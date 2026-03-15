import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLibraryRefreshKey,
  getSelectedLibraryItems,
} from "../../src/modules/copy/interaction/context/libraryContext";

test("buildLibraryRefreshKey uses mode, allowed types, and selected item ids", () => {
  assert.equal(
    buildLibraryRefreshKey({
      mode: "all",
      allowedTypes: ["pdf", "epub"],
      items: [{ id: 11 }, { id: 42 }] as Zotero.Item[],
    }),
    "all|pdf,epub|11,42",
  );
});

test("getSelectedLibraryItems returns an empty array when no pane is active", () => {
  assert.deepEqual(
    getSelectedLibraryItems({
      getActivePane: () => undefined,
    }),
    [],
  );
});
