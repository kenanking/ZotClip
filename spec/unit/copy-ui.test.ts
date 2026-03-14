import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getToolbarIconDataURL,
  initToolbarIcon,
} from "../../src/modules/copy/copyUi";

test("reader toolbar data url is generated from the shared toolbar svg source file after async init", async () => {
  const iconFile = fs.readFileSync(
    path.resolve(process.cwd(), "addon/content/icons/toolbar-icon.svg"),
    "utf8",
  );
  await initToolbarIcon({
    readIcon: async () => iconFile,
  });
  const dataURL = getToolbarIconDataURL();
  const encodedSvg = dataURL.replace("data:image/svg+xml;utf8,", "");

  assert.equal(decodeURIComponent(encodedSvg), iconFile);
  assert.match(iconFile, /<svg/);
});

test("copyUi does not rely on deprecated runtime SVG loading", () => {
  const copyUiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/copy/copyUi.ts"),
    "utf8",
  );

  assert.doesNotMatch(copyUiSource, /getContentsFromURL\(/);
});

test("copyUi does not depend on a generated toolbar icon module", () => {
  const copyUiSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/copy/copyUi.ts"),
    "utf8",
  );
  const packageJson = fs.readFileSync(
    path.resolve(process.cwd(), "package.json"),
    "utf8",
  );

  assert.doesNotMatch(copyUiSource, /generatedToolbarIcon/);
  assert.doesNotMatch(packageJson, /sync:toolbar-icon/);
});
