import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEffectiveAttachmentTypes,
  validateAttachmentTypeSelection,
} from "../../src/modules/preferenceScript";

test("preference script builds effective types from presets and custom input", () => {
  assert.deepEqual(
    buildEffectiveAttachmentTypes(["pdf", "epub"], " .djvu, azw3 "),
    ["pdf", "epub", "djvu", "azw3"],
  );
});

test("preference script rejects empty attachment-type selection", () => {
  assert.equal(validateAttachmentTypeSelection([], " , . "), false);
});
