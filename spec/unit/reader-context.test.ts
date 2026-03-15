import assert from "node:assert/strict";
import test from "node:test";

import {
  getCurrentReaderItemID,
  isReaderTabSelected,
} from "../../src/modules/copy/interaction/readerContext";

test("getCurrentReaderItemID resolves the active reader item from selected tab state", () => {
  const itemID = getCurrentReaderItemID({
    getTabs: () => ({ selectedID: "reader-tab", selectedType: "reader" }),
    getReaderByTabID: (tabID) =>
      tabID === "reader-tab" ? { itemID: 42 } : undefined,
  });

  assert.equal(itemID, 42);
});

test("getCurrentReaderItemID returns undefined when no reader tab is selected", () => {
  const itemID = getCurrentReaderItemID({
    getTabs: () => ({ selectedID: undefined, selectedType: "library" }),
    getReaderByTabID: () => ({ itemID: 42 }),
  });

  assert.equal(itemID, undefined);
});

test("isReaderTabSelected returns false outside reader context", () => {
  assert.equal(
    isReaderTabSelected({
      getTabs: () => ({ selectedType: "library" }),
    }),
    false,
  );
});
