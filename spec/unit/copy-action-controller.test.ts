import assert from "node:assert/strict";
import test from "node:test";

import { createCopyActionController } from "../../src/modules/copy/interaction/actions/copyActionController";

test("copy action controller returns an enabled reader primary action", async () => {
  const controller = createCopyActionController({
    getAllowedTypes: () => ["pdf"],
    getMode: () => "all",
    getLibraryItems: () => [],
    getReaderItemID: () => 2048,
    getSelectionAvailability: async () => ({
      canCopy: false,
      messageKey: "copy-no-files",
    }),
    getReaderAvailability: async () => ({
      canCopy: true,
    }),
    executePrimaryLibraryCopy: async () => {
      throw new Error("Library copy should not run in reader context.");
    },
    executePrimaryReaderCopy: async () => ({
      ok: true,
      format: "file-object",
      count: 1,
      outcome: "copied-files",
    }),
  });

  const state = await controller.getCurrentActionState();

  assert.equal(state.source, "reader");
  assert.equal(state.refreshKey, "2048|pdf");
  assert.equal(state.primary.kind, "copy-files");
  assert.equal(state.primary.canExecute, true);
});
