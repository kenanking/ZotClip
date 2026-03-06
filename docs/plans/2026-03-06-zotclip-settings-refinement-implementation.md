# ZotClip Settings Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the remaining settings-page regressions by making dropdown labels render correctly, improving field spacing and hierarchy, removing the path-fallback setting, and showing fallback notifications as a file-copy failure with a path-text fallback.

**Architecture:** Keep the existing native `groupbox` preference structure, but restore a thin stylesheet for layout polish and use Fluent/XUL-compatible label attributes for dropdown items. Simplify runtime behavior by removing configurable path fallback and treating it as an always-on fallback, while extending clipboard result metadata so the notifier can present fallback outcomes distinctly from full success.

**Tech Stack:** TypeScript, XUL/XHTML, Fluent (`.ftl`), Node `node:test`, `tsx`, Zotero plugin scaffold

---

### Task 1: Fix dropdown labels and tidy settings layout

**Files:**
- Modify: `addon/content/preferences.xhtml`
- Create: `addon/content/preferences.css`
- Modify: `addon/locale/zh-CN/preferences.ftl`
- Modify: `addon/locale/en-US/preferences.ftl`
- Modify: `spec/unit/preferences-markup.test.ts`
- Create: `spec/unit/preferences-localization.test.ts`

**Step 1: Write the failing tests**

```ts
test("preferences markup restores minimal layout classes and widths", () => {
  assert.match(markup, /class="zotclip-pref-menulist"/);
  assert.match(markup, /class="zotclip-pref-field-label"/);
});

test("dropdown localization defines menuitem labels via Fluent attributes", () => {
  assert.match(ftl, /pref-multi-attachment-mode-all \.label =/);
  assert.match(ftl, /pref-reader-ctrl-c-mode-smart \.label =/);
});
```

**Step 2: Run tests to verify they fail**

Run: `npx tsx --test spec/unit/preferences-markup.test.ts spec/unit/preferences-localization.test.ts`

Expected: FAIL because the current page has no lightweight layout classes or stylesheet and the `.ftl` files define dropdown items as values instead of `.label` attributes.

**Step 3: Write minimal implementation**

```xhtml
<menulist
  id="zotero-prefpane-__addonRef__-multi-attachment-mode"
  class="zotclip-pref-menulist"
  preference="multiAttachmentMode"
>
```

```ftl
pref-multi-attachment-mode-all.label = 复制所有允许的附件
pref-multi-attachment-mode-primary.label = 仅复制主要的允许附件
```

```css
.zotclip-pref-menulist {
  min-width: 18rem;
}
```

Add only minimal spacing/label classes needed for native-looking layout.

**Step 4: Run tests to verify they pass**

Run: `npx tsx --test spec/unit/preferences-markup.test.ts spec/unit/preferences-localization.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add addon/content/preferences.xhtml addon/content/preferences.css addon/locale/zh-CN/preferences.ftl addon/locale/en-US/preferences.ftl spec/unit/preferences-markup.test.ts spec/unit/preferences-localization.test.ts
git commit -m "fix: restore dropdown labels in settings"
```

### Task 2: Remove the path-fallback preference from the UI and runtime config

**Files:**
- Modify: `addon/content/preferences.xhtml`
- Modify: `addon/locale/zh-CN/preferences.ftl`
- Modify: `addon/locale/en-US/preferences.ftl`
- Modify: `src/utils/prefs.ts`
- Modify: `src/modules/copy/copyCommands.ts`
- Modify: `spec/unit/preferences-markup.test.ts`
- Modify: `spec/unit/copy-commands.test.ts`

**Step 1: Write the failing tests**

```ts
test("preferences markup no longer exposes the path fallback checkbox", () => {
  assert.doesNotMatch(markup, /allow-path-fallback/);
});

test("copy commands always enable path fallback for clipboard writes", async () => {
  let capturedFallback = false;
  await copyFromSelection("all", ["pdf"], false, {
    // ...
    writeClipboard: async (_files, allowPathFallback) => {
      capturedFallback = allowPathFallback;
      return { ok: true, format: "path-text", count: 1, fallbackUsed: true };
    },
  });
  assert.equal(capturedFallback, true);
});
```

**Step 2: Run tests to verify they fail**

Run: `npx tsx --test spec/unit/preferences-markup.test.ts spec/unit/copy-commands.test.ts`

Expected: FAIL because the checkbox still exists and `copyFromSelection`/`copyFromReader` still accept the old fallback argument.

**Step 3: Write minimal implementation**

```ts
return deps.writeClipboard(files, true);
```

Remove the checkbox and its labels from the settings UI and locales. Simplify `prefs.ts` so runtime code no longer reads `allowPathFallback`.

**Step 4: Run tests to verify they pass**

Run: `npx tsx --test spec/unit/preferences-markup.test.ts spec/unit/copy-commands.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add addon/content/preferences.xhtml addon/locale/zh-CN/preferences.ftl addon/locale/en-US/preferences.ftl src/utils/prefs.ts src/modules/copy/copyCommands.ts spec/unit/preferences-markup.test.ts spec/unit/copy-commands.test.ts
git commit -m "refactor: remove path fallback preference"
```

### Task 3: Distinguish fallback-used results in clipboard and notifier flows

**Files:**
- Modify: `src/modules/copy/types.ts`
- Modify: `src/modules/copy/clipboardWriter.ts`
- Modify: `src/modules/copy/notifier.ts`
- Modify: `spec/unit/clipboard-writer.test.ts`
- Modify: `spec/unit/notifier.test.ts`

**Step 1: Write the failing tests**

```ts
test("clipboard writer marks fallback-used results", async () => {
  const result = await writeClipboard(files, true, deps);
  assert.equal(result.ok, true);
  assert.equal(result.format, "path-text");
  assert.equal(result.fallbackUsed, true);
});

test("notifier reports file-copy failure when path fallback is used", () => {
  const message = formatCopyMessage({
    ok: true,
    format: "path-text",
    count: 2,
    fallbackUsed: true,
  });
  assert.equal(
    message,
    "Attachment file copy failed. Copied 2 attachment path(s) instead.",
  );
});
```

**Step 2: Run tests to verify they fail**

Run: `npx tsx --test spec/unit/clipboard-writer.test.ts spec/unit/notifier.test.ts`

Expected: FAIL because `fallbackUsed` does not exist and fallback messages still read as plain success.

**Step 3: Write minimal implementation**

```ts
export interface ClipboardResult {
  ok: boolean;
  format: ClipboardFormat;
  count: number;
  fallbackUsed?: boolean;
  message?: string;
}
```

```ts
if (result.fallbackUsed && result.format === "path-text") {
  return `Attachment file copy failed. Copied ${result.count} attachment path(s) instead.`;
}
```

Set `fallbackUsed: true` whenever path fallback succeeds after a failed file write.

**Step 4: Run tests to verify they pass**

Run: `npx tsx --test spec/unit/clipboard-writer.test.ts spec/unit/notifier.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/copy/types.ts src/modules/copy/clipboardWriter.ts src/modules/copy/notifier.ts spec/unit/clipboard-writer.test.ts spec/unit/notifier.test.ts
git commit -m "fix: surface clipboard fallback as failure"
```

### Task 4: Re-run focused preference-script coverage

**Files:**
- Modify: `src/modules/preferenceScript.ts`
- Modify: `spec/unit/preference-script.test.ts`

**Step 1: Write the failing test**

```ts
test("preference script syncs dropdown value from menuitem labels", () => {
  const menulist = createFakeMenulist(["all", "primary"]);
  const synced = syncMenulistValue(menulist, "primary");
  assert.equal(synced, "primary");
});
```

Add or update any assertion needed if the helper changes after the Fluent-label fix.

**Step 2: Run test to verify it fails**

Run: `npx tsx --test spec/unit/preference-script.test.ts`

Expected: FAIL if helper assumptions no longer match the real menuitem shape after Task 1.

**Step 3: Write minimal implementation**

```ts
function getMenuitemValue(item: MenuitemLike | null): string {
  return item?.value || item?.getAttribute?.("value") || "";
}
```

Adjust only what is needed so the helper still works with the final settings markup.

**Step 4: Run test to verify it passes**

Run: `npx tsx --test spec/unit/preference-script.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/modules/preferenceScript.ts spec/unit/preference-script.test.ts
git commit -m "test: keep preference script coverage aligned"
```

### Task 5: Full verification

**Files:**
- Verify only

**Step 1: Run the unit suite**

Run: `npm run test:unit`

Expected: PASS

**Step 2: Run the build**

Run: `npm run build`

Expected: PASS

**Step 3: Run lint checks**

Run: `npm run lint:check`

Expected: PASS

**Step 4: Manual Zotero verification**

Run: `npm run start`

Check:

1. Both dropdowns show labels immediately in the closed state.
2. Dropdown width feels natural and no text is clipped.
3. `Preset types` and `Custom extensions` use consistent label styling.
4. Attachment-type spacing is less cramped.
5. No path-fallback setting appears.
6. Fallback notifications report file-copy failure with path fallback text.

**Step 5: Commit**

```bash
git add .
git commit -m "fix: refine settings page behavior and messaging"
```
