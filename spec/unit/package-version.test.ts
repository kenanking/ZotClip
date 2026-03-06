import assert from "node:assert/strict";
import test from "node:test";

import pkg from "../../package.json";

test("package version is the in-development baseline", () => {
  assert.equal(pkg.version, "0.0.1");
});
