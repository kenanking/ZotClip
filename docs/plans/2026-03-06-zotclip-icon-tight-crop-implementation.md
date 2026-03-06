# ZotClip Icon Tight-Crop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enlarge the approved ZotClip SVG icon within the existing square canvas so it keeps only a very thin safety border.

**Architecture:** Keep the existing icon paths, gradients, and view box unchanged, and tighten the composition by updating only the outer group transform in both the design master and the packaged runtime SVG. Protect the adjustment with a small regression test that verifies the new transform values and SVG validity.

**Tech Stack:** SVG, TypeScript unit tests, Zotero plugin scaffold

---

### Task 1: Add a regression test for the tighter icon transform

**Files:**

- Modify: `spec/unit/icon-assets.test.ts`
- Test: `spec/unit/icon-assets.test.ts`

**Step 1: Write the failing test**

```ts
test("icon SVG assets use the tightened transform", () => {
  const rootIcon = readFileSync("icon.svg", "utf8");
  const runtimeIcon = readFileSync("addon/content/icons/favicon.svg", "utf8");
  const expectedTransform =
    'transform="translate(-219.480899,1065.401298) scale(0.161000,-0.161000)"';

  assert.match(
    rootIcon,
    new RegExp(expectedTransform.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.match(
    runtimeIcon,
    new RegExp(expectedTransform.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: FAIL because the current transform is still the looser composition.

**Step 3: Write minimal implementation**

No implementation in this task. This task establishes the new expected
transform before touching the SVG files.

**Step 4: Commit**

```bash
git add spec/unit/icon-assets.test.ts
git commit -m "test: define tighter icon transform expectation"
```

### Task 2: Tighten the composition in both SVG assets

**Files:**

- Modify: `icon.svg`
- Modify: `addon/content/icons/favicon.svg`
- Test: `spec/unit/icon-assets.test.ts`

**Step 1: Update the group transform**

Replace the existing outer `<g transform="...">` in both files with the
approved tighter transform so the clip is larger and remains centered.

**Step 2: Run the targeted test to verify it passes**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: PASS, including the new transform assertion.

**Step 3: Confirm both SVG files still parse**

Run:

```powershell
$files = @('icon.svg', 'addon/content/icons/favicon.svg')
foreach ($file in $files) {
  [xml](Get-Content -Raw $file) | Out-Null
}
```

Expected: both SVG files parse without error.

**Step 4: Commit**

```bash
git add icon.svg addon/content/icons/favicon.svg spec/unit/icon-assets.test.ts
git commit -m "style: tighten ZotClip icon crop"
```

### Task 3: Run full verification

**Files:**

- Check: `icon.svg`
- Check: `addon/content/icons/favicon.svg`
- Check: `spec/unit/icon-assets.test.ts`

**Step 1: Run the full unit test suite**

Run: `npm run test:unit`
Expected: PASS.

**Step 2: Run the build**

Run: `npm run build`
Expected: PASS.

**Step 3: Run lint checks**

Run: `npm run lint:check`
Expected: PASS.

**Step 4: Commit**

```bash
git add icon.svg addon/content/icons/favicon.svg spec/unit/icon-assets.test.ts
git commit -m "chore: verify tighter svg icon composition"
```
