# ZotClip Native Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the settings pane to a Zotero-native style, fix menulist label display, and change the addon version to `0.0.1`.

**Architecture:** Reuse the existing preference keys and preference-script entry point, but move the settings markup back to native XUL grouping and keep only the attachment-type controls that are functionally required. Fix the menulist regression in `preferenceScript.ts` with a small synchronization helper that can be unit tested without Zotero. Let the existing scaffold continue injecting the package version into the manifest and preference footer.

**Tech Stack:** TypeScript, Zotero preference panes, XUL/XHTML markup, Node `node:test`, `tsx`, npm

---

### Task 1: Lock in native preference markup with a failing regression test

**Files:**
- Create: `spec/unit/preferences-markup.test.ts`
- Modify: `addon/content/preferences.xhtml`
- Delete: `addon/content/preferences.css`

**Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const markup = readFileSync("addon/content/preferences.xhtml", "utf8");

test("preferences markup uses native layout without custom stylesheet", () => {
  assert.match(markup, /<groupbox/);
  assert.doesNotMatch(markup, /preferences\.css/);
  assert.doesNotMatch(markup, /zotclip-pref-card/);
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test spec/unit/preferences-markup.test.ts`

Expected: FAIL because the current markup still links `preferences.css` and uses custom card containers.

**Step 3: Write minimal implementation**

```xhtml
<groupbox onload="Zotero.__addonInstance__.hooks.onPrefsEvent('load', { window })">
  <label><html:h2 data-l10n-id="pref-title"></html:h2></label>
  <!-- native hbox/checkbox rows -->
</groupbox>
```

Delete `addon/content/preferences.css` if no spacing overrides remain necessary.

**Step 4: Run test to verify it passes**

Run: `npx tsx --test spec/unit/preferences-markup.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add spec/unit/preferences-markup.test.ts addon/content/preferences.xhtml addon/content/preferences.css
git commit -m "fix: restore native preferences layout"
```

### Task 2: Add a failing unit test for menulist value synchronization

**Files:**
- Modify: `spec/unit/preference-script.test.ts`
- Modify: `src/modules/preferenceScript.ts`

**Step 1: Write the failing test**

```ts
test("preference script syncs menulist visible value from stored prefs", () => {
  const menulist = {
    value: "",
    selectedItem: null,
    querySelector: () => null,
  };

  syncMenulistValue(menulist, "primary");

  assert.equal(menulist.value, "primary");
});
```

Add a second test for an unchanged or fallback case if needed:

```ts
test("preference script falls back to the first menu item when value is invalid", () => {
  // fake menulist with two items: all, primary
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test spec/unit/preference-script.test.ts`

Expected: FAIL because `syncMenulistValue` does not exist yet.

**Step 3: Write minimal implementation**

```ts
export function syncMenulistValue(
  menulist: MenulistLike,
  preferredValue: string,
): string {
  const nextValue = findSupportedValue(menulist, preferredValue);
  menulist.value = nextValue;
  return nextValue;
}
```

Call the helper from `registerPrefsScripts(window)` for:

1. `#zotero-prefpane-__addonRef__-multi-attachment-mode`
2. `#zotero-prefpane-__addonRef__-reader-ctrl-c-mode`

Use the current stored prefs as the source of truth.

**Step 4: Run test to verify it passes**

Run: `npx tsx --test spec/unit/preference-script.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add spec/unit/preference-script.test.ts src/modules/preferenceScript.ts
git commit -m "fix: sync preference menulist labels"
```

### Task 3: Change the package version with a regression test

**Files:**
- Create: `spec/unit/package-version.test.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import pkg from "../../package.json";

test("package version is the in-development baseline", () => {
  assert.equal(pkg.version, "0.0.1");
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test spec/unit/package-version.test.ts`

Expected: FAIL because the current version is `3.1.0`.

**Step 3: Write minimal implementation**

```json
{
  "version": "0.0.1"
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test spec/unit/package-version.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add spec/unit/package-version.test.ts package.json
git commit -m "chore: reset development version"
```

### Task 4: Verify the full change set

**Files:**
- Verify only

**Step 1: Run the targeted unit tests**

Run: `npm run test:unit`

Expected: PASS

**Step 2: Run the build**

Run: `npm run build`

Expected: PASS with updated generated version metadata.

**Step 3: Run lint checks**

Run: `npm run lint:check`

Expected: PASS

**Step 4: Manual Zotero verification**

Run: `npm run start`

Check:

1. The settings pane no longer shows card-style sections.
2. Typography and spacing feel native to Zotero.
3. `Multi-Attachment Strategy` shows a label immediately on open.
4. Selecting a menu item updates the visible label in the menulist.
5. The footer version reads `0.0.1`.

**Step 5: Commit**

```bash
git add .
git commit -m "fix: align settings pane with Zotero defaults"
```
