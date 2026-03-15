import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import scaffoldConfig from "../../zotero-plugin.config";
import { config as packageConfig } from "../../package.json";

test("test runner waits only for the addon instance to be registered", () => {
  assert.equal(
    scaffoldConfig.test?.waitForPlugin,
    `() => Boolean(Zotero.${packageConfig.addonInstance})`,
  );
});

test("installed zotero-plugin-scaffold does not ship broken tester placeholders", () => {
  const scaffoldManifestPath = path.join(
    process.cwd(),
    "node_modules/zotero-plugin-scaffold/package.json",
  );
  const scaffoldManifest = JSON.parse(
    fs.readFileSync(scaffoldManifestPath, "utf8"),
  ) as {
    version: string;
  };

  // Keep scaffold pinned until upstream fixes the broken test bootstrap shipped in 0.8.4.
  assert.equal(scaffoldManifest.version, "0.8.3");
});
