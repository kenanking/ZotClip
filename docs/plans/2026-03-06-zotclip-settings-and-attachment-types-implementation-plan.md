# ZotClip Settings and Attachment Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the ZotClip preferences pane, add configurable allowed attachment types for selection and reader copy, and replace the addon icon with the provided artwork.

**Architecture:** Introduce a small attachment-type domain helper that normalizes extension configuration and performs file-extension matching. Thread the effective allowed-type set through the resolver and command layer, then rebuild the preferences pane around grouped sections and a script that keeps preset checkboxes, custom extensions, and validation in sync.

**Tech Stack:** TypeScript, Zotero plugin scaffold, Fluent localization, Node test runner in `spec/unit/`, PowerShell for local asset handling

---

### Task 1: Add attachment-type normalization helpers

**Files:**

- Create: `src/modules/copy/attachmentTypes.ts`
- Create: `spec/unit/attachment-types.test.ts`
- Modify: `src/modules/copy/types.ts`
- Test: `spec/unit/attachment-types.test.ts`

**Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTACHMENT_TYPE_PRESETS,
  extractExtensionFromPath,
  normalizeExtensionList,
} from "../../src/modules/copy/attachmentTypes";

test("attachment types normalize custom extension input", () => {
  assert.deepEqual(normalizeExtensionList(" PDF, .epub, , MOBI ,pdf "), [
    "pdf",
    "epub",
    "mobi",
  ]);
});

test("attachment types extract lowercase extension from path", () => {
  assert.equal(extractExtensionFromPath("C:/Library/Book.EPUB"), "epub");
});

test("attachment type presets stay stable", () => {
  assert.deepEqual(ATTACHMENT_TYPE_PRESETS, ["pdf", "epub", "mobi", "txt"]);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- spec/unit/attachment-types.test.ts`
Expected: FAIL with module not found for `src/modules/copy/attachmentTypes`.

**Step 3: Write minimal implementation**

```ts
export const ATTACHMENT_TYPE_PRESETS = ["pdf", "epub", "mobi", "txt"] as const;

export function normalizeExtensionList(input: string | string[]): string[] {
  const values = Array.isArray(input) ? input : input.split(",");
  const seen = new Set<string>();
  const output: string[] = [];

  for (const raw of values) {
    const normalized = raw.trim().replace(/^\./, "").toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

export function extractExtensionFromPath(path: string): string | undefined {
  const match = /\.([^.\\/]+)$/.exec(path);
  return match ? match[1].toLowerCase() : undefined;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- spec/unit/attachment-types.test.ts`
Expected: PASS with three passing tests.

**Step 5: Commit**

```bash
git add src/modules/copy/attachmentTypes.ts spec/unit/attachment-types.test.ts src/modules/copy/types.ts
git commit -m "feat: add attachment type normalization helpers"
```

### Task 2: Make the resolver filter by allowed attachment types

**Files:**

- Modify: `src/modules/copy/attachmentResolver.ts`
- Modify: `src/modules/copy/types.ts`
- Modify: `spec/unit/attachment-resolver.test.ts`
- Modify: `spec/unit/reader-resolver.test.ts`
- Test: `spec/unit/attachment-resolver.test.ts`
- Test: `spec/unit/reader-resolver.test.ts`

**Step 1: Write the failing tests**

```ts
test("AttachmentResolver: all mode keeps allowed attachment types only", async () => {
  const pdf = makeAttachment(11, "C:/papers/a.pdf", { parentID: 1 });
  const epub = makeAttachment(12, "C:/books/b.epub", {
    parentID: 1,
    isPDF: false,
  });
  const txt = makeAttachment(13, "C:/notes/c.txt", {
    parentID: 1,
    isPDF: false,
  });
  const regular = makeRegular(1, [11, 12, 13]);

  const resolved = await resolveAttachmentsFromItems(
    [regular],
    "all",
    ["pdf", "epub"],
    {
      getItemsByIDs: () => [pdf, epub, txt],
    },
  );

  assert.deepEqual(
    resolved.map((entry) => entry.path),
    ["C:/papers/a.pdf", "C:/books/b.epub"],
  );
});

test("reader resolver rejects attachment when type is not allowed", async () => {
  const attachment = makeAttachment(1001, "C:/books/reader.epub", {
    parentID: 90,
    isPDF: false,
  });

  const resolved = await resolveAttachmentFromReader(1001, ["pdf"], {
    getItemsByIDs: () => [],
    getItemByID: () => attachment,
  });

  assert.deepEqual(resolved, []);
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- spec/unit/attachment-resolver.test.ts spec/unit/reader-resolver.test.ts`
Expected: FAIL because the new resolver signatures and exports do not exist yet.

**Step 3: Write minimal implementation**

```ts
export async function resolveAttachmentsFromItems(
  items: Zotero.Item[],
  mode: MultiAttachmentMode,
  allowedTypes: string[],
  deps: AttachmentResolverDeps = DEFAULT_DEPS,
): Promise<ResolvedAttachment[]> {
  // Resolve candidate attachments, then keep only paths with an allowed extension.
}

export async function resolveAttachmentFromReader(
  itemID: number,
  allowedTypes: string[],
  deps: AttachmentResolverDeps = DEFAULT_DEPS,
): Promise<ResolvedAttachment[]> {
  // Resolve current attachment path, extract extension, and return [] when disallowed.
}
```

Implementation requirements:

- rename `MultiPDFMode` to `MultiAttachmentMode`
- rename `ResolvedPDF` to `ResolvedAttachment`
- for `primary` mode, prefer best attachments first, then fall back to child attachments to find the first allowed type
- continue de-duplicating by path

**Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- spec/unit/attachment-resolver.test.ts spec/unit/reader-resolver.test.ts`
Expected: PASS for all updated resolver cases.

**Step 5: Commit**

```bash
git add src/modules/copy/attachmentResolver.ts src/modules/copy/types.ts spec/unit/attachment-resolver.test.ts spec/unit/reader-resolver.test.ts
git commit -m "feat: filter attachment resolution by allowed types"
```

### Task 3: Thread allowed types through copy commands and preference reads

**Files:**

- Modify: `addon/prefs.js`
- Modify: `typings/prefs.d.ts`
- Modify: `src/utils/prefs.ts`
- Modify: `src/hooks.ts`
- Modify: `src/modules/copy/copyCommands.ts`
- Modify: `spec/unit/copy-commands.test.ts`
- Test: `spec/unit/copy-commands.test.ts`

**Step 1: Write the failing test**

```ts
test("copyFromSelection passes allowed attachment types to the resolver", async () => {
  let seenAllowedTypes: string[] = [];

  await copyFromSelection("all", ["pdf", "epub"], true, {
    getSelectedItems: () => [{ id: 1 } as Zotero.Item],
    getCurrentReaderItemID: () => undefined,
    resolveFromItems: async (_items, _mode, allowedTypes) => {
      seenAllowedTypes = allowedTypes;
      return sampleFiles;
    },
    resolveFromReader: async () => [],
    writeClipboard: async () => ({ ok: true, format: "file-object", count: 1 }),
  });

  assert.deepEqual(seenAllowedTypes, ["pdf", "epub"]);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- spec/unit/copy-commands.test.ts`
Expected: FAIL because `copyFromSelection` and resolver deps do not accept allowed types yet.

**Step 3: Write minimal implementation**

```ts
export function getEnabledAttachmentTypes(): string[] {
  return normalizeExtensionList(getPref("enabledAttachmentTypes") || "");
}

export function getCustomAttachmentTypes(): string[] {
  return normalizeExtensionList(getPref("customAttachmentTypes") || "");
}

export function getAllowedAttachmentTypes(): string[] {
  return normalizeExtensionList([
    ...getEnabledAttachmentTypes(),
    ...getCustomAttachmentTypes(),
  ]);
}
```

Implementation requirements:

- replace `multiPdfMode` with `multiAttachmentMode`
- update `copyFromSelection` to accept `allowedTypes`
- update `copyFromReader` to accept `allowedTypes`
- have `src/hooks.ts` pass `getAllowedAttachmentTypes()` into both command paths

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- spec/unit/copy-commands.test.ts`
Expected: PASS with updated command-layer assertions.

**Step 5: Commit**

```bash
git add addon/prefs.js typings/prefs.d.ts src/utils/prefs.ts src/hooks.ts src/modules/copy/copyCommands.ts spec/unit/copy-commands.test.ts
git commit -m "feat: wire allowed attachment types through copy commands"
```

### Task 4: Redesign the preferences pane and add validation logic

**Files:**

- Modify: `addon/content/preferences.xhtml`
- Create: `addon/content/preferences.css`
- Modify: `src/modules/preferenceScript.ts`
- Modify: `addon/locale/en-US/preferences.ftl`
- Modify: `addon/locale/zh-CN/preferences.ftl`
- Modify: `typings/i10n.d.ts`
- Create: `spec/unit/preference-script.test.ts`
- Test: `spec/unit/preference-script.test.ts`

**Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEffectiveAttachmentTypes,
  validateAttachmentTypeSelection,
} from "../../src/modules/preferenceScript";

test("preference script builds effective types from presets and custom input", () => {
  assert.deepEqual(
    buildEffectiveAttachmentTypes(["pdf", "epub"], " .djvu, azw3 "),
    ["pdf", "epub", "djvu", "azw3"],
  );
});

test("preference script rejects empty attachment-type selection", () => {
  assert.equal(validateAttachmentTypeSelection([], " , . "), false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- spec/unit/preference-script.test.ts`
Expected: FAIL because the helper functions do not exist yet.

**Step 3: Write minimal implementation**

```ts
export function buildEffectiveAttachmentTypes(
  enabledTypes: string[],
  customInput: string,
): string[] {
  return normalizeExtensionList([
    ...enabledTypes,
    ...normalizeExtensionList(customInput),
  ]);
}

export function validateAttachmentTypeSelection(
  enabledTypes: string[],
  customInput: string,
): boolean {
  return buildEffectiveAttachmentTypes(enabledTypes, customInput).length > 0;
}
```

Implementation requirements:

- group the pane into `Copy Scope`, `Allowed Attachment Types`, and `Compatibility`
- rename the dropdown label to `Multi-Attachment Strategy`
- render preset type checkboxes for `PDF`, `EPUB`, `MOBI`, `TXT`
- add a custom extension text field with helper text
- link `addon/content/preferences.css` from the XHTML
- on preferences load, normalize custom input display and surface inline validation feedback

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- spec/unit/preference-script.test.ts`
Expected: PASS with two passing helper tests.

**Step 5: Commit**

```bash
git add addon/content/preferences.xhtml addon/content/preferences.css src/modules/preferenceScript.ts addon/locale/en-US/preferences.ftl addon/locale/zh-CN/preferences.ftl typings/i10n.d.ts spec/unit/preference-script.test.ts
git commit -m "feat: redesign preferences pane for attachment type control"
```

### Task 5: Update notifier and menu wording for attachment-oriented copy

**Files:**

- Modify: `src/modules/copy/notifier.ts`
- Modify: `spec/unit/notifier.test.ts`
- Modify: `addon/locale/en-US/addon.ftl`
- Modify: `addon/locale/zh-CN/addon.ftl`
- Modify: `README.md`
- Test: `spec/unit/notifier.test.ts`

**Step 1: Write the failing test**

```ts
test("notifier formats successful copy message with attachment wording", () => {
  assert.equal(
    formatCopyMessage({ ok: true, format: "file-object", count: 2 }),
    "Copied 2 attachment file(s) to clipboard (file-object).",
  );
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- spec/unit/notifier.test.ts`
Expected: FAIL because notifier still says `PDF file(s)`.

**Step 3: Write minimal implementation**

```ts
if (result.format === "path-text") {
  return `File clipboard unavailable. Copied ${result.count} attachment path(s) instead.`;
}

return `Copied ${result.count} attachment file(s) to clipboard (${result.format}).`;
```

Implementation requirements:

- update menu labels in both locales from `PDF` wording to `attachment` wording
- update README feature and usage text to describe attachment-type filtering

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- spec/unit/notifier.test.ts`
Expected: PASS for all notifier cases.

**Step 5: Commit**

```bash
git add src/modules/copy/notifier.ts spec/unit/notifier.test.ts addon/locale/en-US/addon.ftl addon/locale/zh-CN/addon.ftl README.md
git commit -m "docs: update copy wording for attachment type support"
```

### Task 6: Replace the icon assets with the provided artwork

**Files:**

- Modify: `icon.png`
- Modify: `addon/content/icons/favicon.png`
- Modify: `addon/content/icons/favicon@0.5x.png`

**Step 1: Prepare the source asset**

Use the provided `icon.png` in the repository root as the canonical source.

**Step 2: Generate addon icon sizes**

Run:

```powershell
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile("icon.png")
$sizes = @{
  "addon/content/icons/favicon.png" = 96
  "addon/content/icons/favicon@0.5x.png" = 48
}
foreach ($entry in $sizes.GetEnumerator()) {
  $bmp = New-Object System.Drawing.Bitmap $entry.Value, $entry.Value
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $entry.Value, $entry.Value)
  $bmp.Save((Resolve-Path $entry.Key), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}
$src.Dispose()
```

Expected: both addon icon files are updated from the new root asset.

**Step 3: Verify manifest references remain correct**

Run: `Get-Content addon\manifest.json`
Expected: manifest still points to `content/icons/favicon@0.5x.png` and `content/icons/favicon.png`.

**Step 4: Commit**

```bash
git add icon.png addon/content/icons/favicon.png addon/content/icons/favicon@0.5x.png
git commit -m "feat: replace ZotClip icon assets"
```

### Task 7: Refresh manual docs and run full verification

**Files:**

- Modify: `docs/testing/2026-03-05-zotclip-v1-manual-checklist.md`
- Modify: `README.md`

**Step 1: Update the manual checklist**

Add scenarios for:

- toggling preset attachment types
- entering custom extensions
- blocking empty allowed-type configuration
- reader copy failure when current type is disabled
- reader copy success when current type is enabled

**Step 2: Run targeted unit tests**

Run: `npm run test:unit -- spec/unit/attachment-types.test.ts spec/unit/attachment-resolver.test.ts spec/unit/reader-resolver.test.ts spec/unit/copy-commands.test.ts spec/unit/preference-script.test.ts spec/unit/notifier.test.ts`
Expected: PASS for all targeted suites.

**Step 3: Run full verification**

Run: `npm run test:unit`
Expected: PASS.

Run: `npm run build`
Expected: PASS with `tsc --noEmit` succeeding.

Run: `npm run lint:check`
Expected: PASS with no lint or formatting errors.

**Step 4: Commit**

```bash
git add docs/testing/2026-03-05-zotclip-v1-manual-checklist.md README.md
git commit -m "docs: add verification notes for attachment type settings"
```
