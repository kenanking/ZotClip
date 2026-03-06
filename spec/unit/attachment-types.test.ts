import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTACHMENT_TYPE_PRESETS,
  extractExtensionFromPath,
  normalizeExtensionList,
} from "../../src/modules/copy/attachmentTypes";

test("attachment types normalize custom extension input", () => {
  assert.deepEqual(
    normalizeExtensionList(" PDF, .epub, , MOBI ,pdf "),
    ["pdf", "epub", "mobi"],
  );
});

test("attachment types extract lowercase extension from path", () => {
  assert.equal(extractExtensionFromPath("C:/Library/Book.EPUB"), "epub");
});

test("attachment type presets stay stable", () => {
  assert.deepEqual(ATTACHMENT_TYPE_PRESETS, ["pdf", "epub", "mobi", "txt"]);
});
