import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("runtime SVG icon asset exists", () => {
  assert.equal(existsSync("addon/content/icons/favicon.svg"), true);
});

test("runtime SVG icon parses as SVG", () => {
  const source = readFileSync("addon/content/icons/favicon.svg", "utf8");
  assert.match(source, /<svg[\s>]/);
});

test("runtime SVG icon uses the tightened transform", () => {
  const runtimeIcon = readFileSync("addon/content/icons/favicon.svg", "utf8");
  const expectedTransform =
    'transform="translate(-219.480899,1065.401298) scale(0.161000,-0.161000)"';
  const expectedPattern = new RegExp(
    expectedTransform.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );

  assert.match(runtimeIcon, expectedPattern);
});

test("manifest icons point to the packaged SVG", () => {
  const manifest = JSON.parse(readFileSync("addon/manifest.json", "utf8"));

  assert.equal(manifest.icons["48"], "content/icons/favicon.svg");
  assert.equal(manifest.icons["96"], "content/icons/favicon.svg");
});

test("runtime code references the packaged SVG icon", () => {
  const hooks = readFileSync("src/hooks.ts", "utf8");
  const toolkit = readFileSync("src/utils/ztoolkit.ts", "utf8");

  assert.match(hooks, /content\/icons\/favicon\.svg/);
  assert.match(toolkit, /content\/icons\/favicon\.svg/);
});

test("addon PNG icon assets are removed", () => {
  assert.equal(existsSync("addon/content/icons/favicon.png"), false);
  assert.equal(existsSync("addon/content/icons/favicon@0.5x.png"), false);
});

test("runtime sources do not reference PNG icon assets", () => {
  const manifest = readFileSync("addon/manifest.json", "utf8");
  const hooks = readFileSync("src/hooks.ts", "utf8");
  const toolkit = readFileSync("src/utils/ztoolkit.ts", "utf8");

  assert.doesNotMatch(manifest, /favicon(?:@0\.5x)?\.png/);
  assert.doesNotMatch(hooks, /favicon(?:@0\.5x)?\.png/);
  assert.doesNotMatch(toolkit, /favicon(?:@0\.5x)?\.png/);
});

test("custom menu registrations use the packaged SVG icon", () => {
  const hooks = readFileSync("src/hooks.ts", "utf8");

  assert.match(
    hooks,
    /^const menuIcon = `chrome:\/\/\$\{config\.addonRef\}\/content\/icons\/favicon\.svg`;/m,
  );
  assert.doesNotMatch(
    hooks,
    /const menuIcon = `chrome:\/\/\$\{addon\.data\.config\.addonRef\}\/content\/icons\/favicon\.svg`;/,
  );
  assert.match(
    hooks,
    /ztoolkit\.Menu\.register\("item",[\s\S]*?icon: menuIcon,/,
  );
  assert.match(
    hooks,
    /ztoolkit\.Menu\.register\("menuTools",[\s\S]*?icon: menuIcon,/,
  );
});
