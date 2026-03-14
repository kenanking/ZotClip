import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const worktreeRoot = process.cwd();
const copyTypesPath = path.join(worktreeRoot, "src/modules/copy/types.ts");
const copyMessagesPath = path.join(
  worktreeRoot,
  "src/modules/copy/copyMessages.ts",
);
const windowUtilsPath = path.join(worktreeRoot, "src/utils/window.ts");

test("copy result types no longer expose the dead copied-file-uris outcome", () => {
  const typesSource = fs.readFileSync(copyTypesPath, "utf8");
  const messagesSource = fs.readFileSync(copyMessagesPath, "utf8");

  assert.equal(typesSource.includes('"copied-file-uris"'), false);
  assert.equal(messagesSource.includes('"copy-notify-file-uris"'), false);
});

test("legacy window utility helper file has been removed", () => {
  assert.equal(fs.existsSync(windowUtilsPath), false);
});
