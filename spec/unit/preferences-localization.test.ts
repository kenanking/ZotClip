import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const zhCn = readFileSync(
  new URL("../../addon/locale/zh-CN/preferences.ftl", import.meta.url),
  "utf8",
);
const enUs = readFileSync(
  new URL("../../addon/locale/en-US/preferences.ftl", import.meta.url),
  "utf8",
);

test("dropdown localization defines menuitem labels via Fluent attributes", () => {
  assert.match(zhCn, /pref-multi-attachment-mode-all =\s+\.label =/);
  assert.match(zhCn, /pref-reader-ctrl-c-mode-smart =\s+\.label =/);
  assert.match(enUs, /pref-multi-attachment-mode-all =\s+\.label =/);
  assert.match(enUs, /pref-reader-ctrl-c-mode-smart =\s+\.label =/);
});
