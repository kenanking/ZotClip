import assert from "node:assert/strict";
import test from "node:test";

import { CLIPBOARD_FORMATS, RESOLVE_ERRORS } from "../../src/modules/copy/types";

test("copy types expose stable clipboard formats and resolve errors", () => {
  assert.deepEqual(CLIPBOARD_FORMATS, [
    "file-object",
    "uri-list",
    "path-text",
    "none",
  ]);
  assert.ok(RESOLVE_ERRORS.includes("RESOLVE_EMPTY"));
});
