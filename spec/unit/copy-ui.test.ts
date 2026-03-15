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
