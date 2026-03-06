# ZotClip SVG-Only Icon Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace ZotClip's runtime PNG icon pipeline with a single SVG icon asset and remove the addon PNG icon files.

**Architecture:** Keep the existing root `icon.svg` as the design source, add one packaged runtime SVG at `addon/content/icons/favicon.svg`, and point every runtime icon reference to that file. Add a narrow regression test that verifies runtime references use SVG and that PNG references are removed.

**Tech Stack:** TypeScript, Zotero plugin scaffold, Node test runner, SVG/XML assets

---

### Task 1: Add the packaged runtime SVG asset

**Files:**

- Create: `addon/content/icons/favicon.svg`
- Modify: `icon.svg`
- Test: `spec/unit/icon-assets.test.ts`

**Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("runtime SVG icon asset exists", () => {
  assert.equal(existsSync("addon/content/icons/favicon.svg"), true);
});

test("runtime SVG icon parses as SVG", () => {
  const source = readFileSync("addon/content/icons/favicon.svg", "utf8");
  assert.match(source, /<svg[\s>]/);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: FAIL because `addon/content/icons/favicon.svg` does not exist yet.

**Step 3: Write minimal implementation**

Create `addon/content/icons/favicon.svg` using the approved ink-green icon
artwork from the root `icon.svg`.

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: PASS for the SVG existence and shape checks.

**Step 5: Commit**

```bash
git add addon/content/icons/favicon.svg icon.svg spec/unit/icon-assets.test.ts
git commit -m "feat: add packaged svg icon asset"
```

### Task 2: Switch all runtime icon references to SVG

**Files:**

- Modify: `addon/manifest.json`
- Modify: `src/hooks.ts`
- Modify: `src/utils/ztoolkit.ts`
- Modify: `spec/unit/icon-assets.test.ts`
- Test: `spec/unit/icon-assets.test.ts`

**Step 1: Write the failing test**

```ts
test("manifest icons point to the packaged SVG", () => {
  const manifest = JSON.parse(readFileSync("addon/manifest.json", "utf8"));
  assert.equal(manifest.icons["48"], "content/icons/favicon.svg");
  assert.equal(manifest.icons["96"], "content/icons/favicon.svg");
});

test("runtime code references the packaged SVG icon", () => {
  const hooks = readFileSync("src/hooks.ts", "utf8");
  const toolkit = readFileSync("src/utils/ztoolkit.ts", "utf8");

  assert.match(hooks, /content\\/icons\\/favicon\\.svg/);
  assert.match(toolkit, /content\\/icons\\/favicon\\.svg/);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: FAIL because the manifest and source files still reference PNG icons.

**Step 3: Write minimal implementation**

Update:

- `addon/manifest.json` so both icon sizes point to `content/icons/favicon.svg`
- `src/hooks.ts` so the preference pane `image` uses `favicon.svg`
- `src/utils/ztoolkit.ts` so `ProgressWindow.setIconURI()` uses `favicon.svg`

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: PASS for the runtime SVG reference checks.

**Step 5: Commit**

```bash
git add addon/manifest.json src/hooks.ts src/utils/ztoolkit.ts spec/unit/icon-assets.test.ts
git commit -m "feat: switch runtime icon references to svg"
```

### Task 3: Remove addon PNG icon assets and guard against regression

**Files:**

- Delete: `addon/content/icons/favicon.png`
- Delete: `addon/content/icons/favicon@0.5x.png`
- Modify: `spec/unit/icon-assets.test.ts`
- Test: `spec/unit/icon-assets.test.ts`

**Step 1: Write the failing test**

```ts
test("addon png icon assets are removed", () => {
  assert.equal(existsSync("addon/content/icons/favicon.png"), false);
  assert.equal(existsSync("addon/content/icons/favicon@0.5x.png"), false);
});

test("runtime sources do not reference png icon assets", () => {
  const manifest = readFileSync("addon/manifest.json", "utf8");
  const hooks = readFileSync("src/hooks.ts", "utf8");
  const toolkit = readFileSync("src/utils/ztoolkit.ts", "utf8");

  assert.doesNotMatch(manifest, /favicon(?:@0\\.5x)?\\.png/);
  assert.doesNotMatch(hooks, /favicon(?:@0\\.5x)?\\.png/);
  assert.doesNotMatch(toolkit, /favicon(?:@0\\.5x)?\\.png/);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: FAIL because the addon PNG files still exist.

**Step 3: Write minimal implementation**

Delete:

- `addon/content/icons/favicon.png`
- `addon/content/icons/favicon@0.5x.png`

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: PASS with no PNG asset files or PNG runtime references remaining.

**Step 5: Commit**

```bash
git add spec/unit/icon-assets.test.ts addon/content/icons/favicon.png addon/content/icons/favicon@0.5x.png
git commit -m "chore: remove addon png icon assets"
```

### Task 4: Run full verification

**Files:**

- Check: `addon/content/icons/favicon.svg`
- Check: `addon/manifest.json`
- Check: `src/hooks.ts`
- Check: `src/utils/ztoolkit.ts`
- Check: `spec/unit/icon-assets.test.ts`

**Step 1: Run the targeted regression test**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: PASS.

**Step 2: Run the full unit test suite**

Run: `npm run test:unit`
Expected: PASS.

**Step 3: Run the build**

Run: `npm run build`
Expected: PASS with the addon packaging step succeeding.

**Step 4: Run lint checks**

Run: `npm run lint:check`
Expected: PASS with no formatting or ESLint errors.

**Step 5: Commit**

```bash
git add addon/content/icons/favicon.svg addon/manifest.json src/hooks.ts src/utils/ztoolkit.ts spec/unit/icon-assets.test.ts
git commit -m "feat: migrate ZotClip runtime icons to svg only"
```
