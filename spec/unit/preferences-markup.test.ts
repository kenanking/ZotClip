import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const markup = readFileSync(
  new URL("../../addon/content/preferences.xhtml", import.meta.url),
  "utf8",
);

test("preferences markup uses native layout without custom stylesheet", () => {
  assert.match(markup, /<groupbox/);
  assert.doesNotMatch(markup, /zotclip-pref-card/);
  assert.match(markup, /class="zotclip-pref-menulist"/);
  assert.match(markup, /class="zotclip-pref-field-label"/);
  assert.match(markup, /chrome:\/\/__addonRef__\/content\/preferences\.css/);
});
