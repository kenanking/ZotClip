import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const worktreeRoot = process.cwd();
const enAddonPath = path.join(worktreeRoot, "addon/locale/en-US/addon.ftl");
const zhAddonPath = path.join(worktreeRoot, "addon/locale/zh-CN/addon.ftl");
const enMainWindowPath = path.join(
  worktreeRoot,
  "addon/locale/en-US/mainWindow.ftl",
);
const zhMainWindowPath = path.join(
  worktreeRoot,
  "addon/locale/zh-CN/mainWindow.ftl",
);

test("toolbar labels and unavailable messages used by getString live in addon locale files", () => {
  const enAddon = fs.readFileSync(enAddonPath, "utf8");
  const zhAddon = fs.readFileSync(zhAddonPath, "utf8");
  const enMainWindow = fs.readFileSync(enMainWindowPath, "utf8");
  const zhMainWindow = fs.readFileSync(zhMainWindowPath, "utf8");

  assert.match(enAddon, /^mainwindow-copy-toolbar = Copy File$/m);
  assert.match(zhAddon, /^mainwindow-copy-toolbar = 复制文件$/m);
  assert.match(
    enAddon,
    /^mainwindow-copy-selected-unavailable = No eligible attachments selected$/m,
  );
  assert.match(
    zhAddon,
    /^mainwindow-copy-selected-unavailable = 当前没有可复制的附件$/m,
  );
  assert.match(
    enAddon,
    /^mainwindow-copy-reader-no-active = No active reader attachment$/m,
  );
  assert.match(
    zhAddon,
    /^mainwindow-copy-reader-no-active = 当前没有活动的阅读器附件$/m,
  );
  assert.match(
    enAddon,
    /^mainwindow-copy-reader-unavailable = No eligible reader attachment$/m,
  );
  assert.match(
    zhAddon,
    /^mainwindow-copy-reader-unavailable = 当前附件不可复制$/m,
  );
  assert.doesNotMatch(enMainWindow, /^mainwindow-copy-toolbar = /m);
  assert.doesNotMatch(
    enMainWindow,
    /^mainwindow-copy-selected-unavailable = /m,
  );
  assert.doesNotMatch(enMainWindow, /^mainwindow-copy-reader-no-active = /m);
  assert.doesNotMatch(enMainWindow, /^mainwindow-copy-reader-unavailable = /m);
  assert.doesNotMatch(zhMainWindow, /^mainwindow-copy-toolbar = /m);
  assert.doesNotMatch(
    zhMainWindow,
    /^mainwindow-copy-selected-unavailable = /m,
  );
  assert.doesNotMatch(zhMainWindow, /^mainwindow-copy-reader-no-active = /m);
  assert.doesNotMatch(zhMainWindow, /^mainwindow-copy-reader-unavailable = /m);
});
