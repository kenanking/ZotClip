# ZotClip Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Zotero 8 plugin named ZotClip that copies PDF attachment files from library selection and reader context, with configurable multi-PDF behavior and clipboard fallback.

**Architecture:** The plugin is split into independent modules: resolver, clipboard writer, reader hook, command layer, and preferences. All copy actions follow one pipeline: resolve attachment file paths, attempt clipboard write with fallback, then notify the user with concrete result format and item count. Reader `Ctrl+C` uses smart interception to avoid breaking native text copy.

**Tech Stack:** TypeScript, windingwind/zotero-plugin-template, zotero-plugin-toolkit, zotero-types, Mocha/Chai (template default)

---

### Task 1: Initialize ZotClip from template baseline

**Files:**
- Create: `package.json`, `tsconfig.json`, `zotero-plugin.config.ts`, `src/index.ts`, `src/hooks.ts`, `addon/manifest.json`, `test/startup.test.ts`
- Modify: `docs/plans/2026-03-05-zotclip-design.md` (no content change, reference-only)
- Test: `test/startup.test.ts`

**Step 1: Bootstrap template files**

```bash
TMP_DIR="$(mktemp -d)"
npx degit windingwind/zotero-plugin-template "$TMP_DIR"
rsync -a --exclude='.git' "$TMP_DIR"/ ./
rm -rf "$TMP_DIR"
```

**Step 2: Rename plugin metadata to ZotClip**

```json
// package.json (config section)
{
  "config": {
    "addonName": "ZotClip",
    "addonID": "zotclip@cvrsg.dev",
    "addonRef": "zotclip",
    "addonInstance": "ZotClip",
    "prefsPrefix": "extensions.zotero.zotclip"
  }
}
```

**Step 3: Install deps and run baseline test/build**

Run: `npm install && npm test && npm run build`
Expected: startup test passes and build exits 0.

**Step 4: Remove template example modules not needed in v1**

```ts
// src/hooks.ts
// Keep only startup/shutdown wiring; remove example registrations.
```

**Step 5: Commit**

```bash
git add .
git commit -m "chore: bootstrap ZotClip from plugin template"
```

Skill refs: `@using-git-worktrees`, `@verification-before-completion`

### Task 2: Define shared copy domain types and result contracts

**Files:**
- Create: `src/modules/copy/types.ts`
- Create: `test/unit/copy-types.test.ts`
- Modify: `src/index.ts`
- Test: `test/unit/copy-types.test.ts`

**Step 1: Write the failing test**

```ts
// test/unit/copy-types.test.ts
import { expect } from "chai";
import { CLIPBOARD_FORMATS, RESOLVE_ERRORS } from "../../src/modules/copy/types";

describe("copy types", () => {
  it("exposes stable clipboard formats and resolve errors", () => {
    expect(CLIPBOARD_FORMATS).to.deep.equal([
      "file-object",
      "uri-list",
      "path-text",
      "none",
    ]);
    expect(RESOLVE_ERRORS).to.include("RESOLVE_EMPTY");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/unit/copy-types.test.ts`
Expected: FAIL with module not found for `src/modules/copy/types`.

**Step 3: Write minimal implementation**

```ts
// src/modules/copy/types.ts
export const CLIPBOARD_FORMATS = [
  "file-object",
  "uri-list",
  "path-text",
  "none",
] as const;

export const RESOLVE_ERRORS = [
  "RESOLVE_EMPTY",
  "RESOLVE_PARTIAL",
  "CLIPBOARD_FILE_FAILED",
  "CLIPBOARD_FALLBACK_USED",
  "CLIPBOARD_ALL_FAILED",
] as const;

export type ClipboardFormat = (typeof CLIPBOARD_FORMATS)[number];
export type ResolveErrorCode = (typeof RESOLVE_ERRORS)[number];

export type MultiPDFMode = "all" | "primary";

export interface ResolvedPDF {
  itemID: number;
  attachmentID: number;
  path: string;
}

export interface ClipboardResult {
  ok: boolean;
  format: ClipboardFormat;
  count: number;
  message?: string;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/unit/copy-types.test.ts`
Expected: PASS with 1 passing test.

**Step 5: Commit**

```bash
git add src/modules/copy/types.ts test/unit/copy-types.test.ts
git commit -m "feat: add copy domain types"
```

Skill refs: `@test-driven-development`

### Task 3: Implement AttachmentResolver with all/primary strategy

**Files:**
- Create: `src/modules/copy/attachmentResolver.ts`
- Create: `test/unit/attachment-resolver.test.ts`
- Modify: `src/modules/copy/types.ts`
- Test: `test/unit/attachment-resolver.test.ts`

**Step 1: Write the failing tests**

```ts
// test/unit/attachment-resolver.test.ts
import { expect } from "chai";
import { resolvePDFsFromItems } from "../../src/modules/copy/attachmentResolver";

describe("AttachmentResolver", () => {
  it("collects all PDF children in all mode", async () => {
    const resolved = await resolvePDFsFromItems([makeRegularItem()], "all");
    expect(resolved.map((r) => r.path)).to.deep.equal([
      "C:/papers/a.pdf",
      "C:/papers/b.pdf",
    ]);
  });

  it("uses best attachment in primary mode", async () => {
    const resolved = await resolvePDFsFromItems([makeRegularItem()], "primary");
    expect(resolved).to.have.length(1);
    expect(resolved[0].path).to.equal("C:/papers/a.pdf");
  });

  it("accepts selected PDF attachment directly", async () => {
    const resolved = await resolvePDFsFromItems([makePDFAttachmentItem()], "all");
    expect(resolved).to.have.length(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/unit/attachment-resolver.test.ts`
Expected: FAIL with missing resolver module.

**Step 3: Write minimal implementation**

```ts
// src/modules/copy/attachmentResolver.ts
import type { MultiPDFMode, ResolvedPDF } from "./types";

export async function resolvePDFsFromItems(
  items: Zotero.Item[],
  mode: MultiPDFMode,
): Promise<ResolvedPDF[]> {
  const results: ResolvedPDF[] = [];
  for (const item of items) {
    const attachments = await resolveCandidateAttachments(item, mode);
    for (const att of attachments) {
      if (!att.isPDFAttachment()) continue;
      const path = await att.getFilePathAsync();
      if (!path) continue;
      results.push({ itemID: item.id, attachmentID: att.id, path });
    }
  }
  return dedupeByPath(results);
}

async function resolveCandidateAttachments(
  item: Zotero.Item,
  mode: MultiPDFMode,
): Promise<Zotero.Item[]> {
  if (item.isAttachment()) {
    return item.isPDFAttachment() ? [item] : [];
  }
  if (mode === "primary") {
    const bestMany = await item.getBestAttachments();
    if (bestMany?.length) return bestMany;
    const bestOne = await item.getBestAttachment();
    return bestOne ? [bestOne] : [];
  }
  const childIDs = item.getAttachments(true);
  return Zotero.Items.get(childIDs);
}

function dedupeByPath(input: ResolvedPDF[]): ResolvedPDF[] {
  const seen = new Set<string>();
  return input.filter((r) => {
    if (seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/unit/attachment-resolver.test.ts`
Expected: PASS with all resolver cases passing.

**Step 5: Commit**

```bash
git add src/modules/copy/attachmentResolver.ts test/unit/attachment-resolver.test.ts
git commit -m "feat: add PDF attachment resolver with all/primary modes"
```

Skill refs: `@test-driven-development`

### Task 4: Implement reader-item resolver path

**Files:**
- Modify: `src/modules/copy/attachmentResolver.ts`
- Create: `test/unit/reader-resolver.test.ts`
- Test: `test/unit/reader-resolver.test.ts`

**Step 1: Write the failing test**

```ts
// test/unit/reader-resolver.test.ts
import { expect } from "chai";
import { resolvePDFFromReader } from "../../src/modules/copy/attachmentResolver";

describe("reader resolver", () => {
  it("resolves current reader attachment item to one PDF", async () => {
    const resolved = await resolvePDFFromReader(1001);
    expect(resolved).to.have.length(1);
    expect(resolved[0].attachmentID).to.equal(1001);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/unit/reader-resolver.test.ts`
Expected: FAIL with missing export `resolvePDFFromReader`.

**Step 3: Write minimal implementation**

```ts
// in src/modules/copy/attachmentResolver.ts
export async function resolvePDFFromReader(itemID: number): Promise<ResolvedPDF[]> {
  const item = Zotero.Items.get(itemID);
  if (!item || !item.isAttachment() || !item.isPDFAttachment()) {
    return [];
  }
  const path = await item.getFilePathAsync();
  if (!path) return [];
  return [{ itemID: item.parentID || item.id, attachmentID: item.id, path }];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/unit/reader-resolver.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/modules/copy/attachmentResolver.ts test/unit/reader-resolver.test.ts
git commit -m "feat: resolve PDF from reader attachment item"
```

Skill refs: `@test-driven-development`

### Task 5: Implement ClipboardWriter with fallback chain

**Files:**
- Create: `src/modules/copy/clipboardWriter.ts`
- Create: `test/unit/clipboard-writer.test.ts`
- Modify: `src/modules/copy/types.ts`
- Test: `test/unit/clipboard-writer.test.ts`

**Step 1: Write the failing tests**

```ts
// test/unit/clipboard-writer.test.ts
import { expect } from "chai";
import { writeClipboard } from "../../src/modules/copy/clipboardWriter";

describe("ClipboardWriter", () => {
  it("returns file-object when native write succeeds", async () => {
    const result = await writeClipboard([{ attachmentID: 1, itemID: 1, path: "C:/a.pdf" }], true);
    expect(result.ok).to.equal(true);
    expect(result.format).to.equal("file-object");
  });

  it("falls back to path-text when native write fails", async () => {
    forceNativeWriteFailure();
    const result = await writeClipboard([{ attachmentID: 1, itemID: 1, path: "C:/a.pdf" }], true);
    expect(result.ok).to.equal(true);
    expect(result.format).to.equal("path-text");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/unit/clipboard-writer.test.ts`
Expected: FAIL with missing writer module.

**Step 3: Write minimal implementation**

```ts
// src/modules/copy/clipboardWriter.ts
import type { ClipboardResult, ResolvedPDF } from "./types";

export async function writeClipboard(
  files: ResolvedPDF[],
  allowPathFallback: boolean,
): Promise<ClipboardResult> {
  if (!files.length) return { ok: false, format: "none", count: 0, message: "No files" };

  if (await tryWriteFileObject(files)) {
    return { ok: true, format: "file-object", count: files.length };
  }

  if (await tryWriteURIList(files)) {
    return { ok: true, format: "uri-list", count: files.length };
  }

  if (allowPathFallback && tryWritePathText(files)) {
    return { ok: true, format: "path-text", count: files.length };
  }

  return {
    ok: false,
    format: "none",
    count: files.length,
    message: "Clipboard write failed",
  };
}

async function tryWriteFileObject(_files: ResolvedPDF[]): Promise<boolean> {
  return false;
}

async function tryWriteURIList(_files: ResolvedPDF[]): Promise<boolean> {
  return false;
}

function tryWritePathText(files: ResolvedPDF[]): boolean {
  const payload = files.map((f) => f.path).join("\n");
  Zotero.Utilities.Internal.copyTextToClipboard(payload);
  return true;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/unit/clipboard-writer.test.ts`
Expected: PASS for file-object and fallback paths after test doubles are wired.

**Step 5: Commit**

```bash
git add src/modules/copy/clipboardWriter.ts test/unit/clipboard-writer.test.ts
git commit -m "feat: add clipboard writer with fallback chain"
```

Skill refs: `@test-driven-development`, `@systematic-debugging`

### Task 6: Implement command layer for selection and reader copy actions

**Files:**
- Create: `src/modules/copy/copyCommands.ts`
- Create: `test/unit/copy-commands.test.ts`
- Modify: `src/hooks.ts`
- Test: `test/unit/copy-commands.test.ts`

**Step 1: Write the failing tests**

```ts
// test/unit/copy-commands.test.ts
import { expect } from "chai";
import { copyFromSelection, copyFromReader } from "../../src/modules/copy/copyCommands";

describe("copy commands", () => {
  it("copies from current Zotero pane selection", async () => {
    const result = await copyFromSelection();
    expect(result.ok).to.equal(true);
  });

  it("copies from current reader item", async () => {
    const result = await copyFromReader();
    expect(result.ok).to.equal(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/unit/copy-commands.test.ts`
Expected: FAIL with missing commands module.

**Step 3: Write minimal implementation**

```ts
// src/modules/copy/copyCommands.ts
import { resolvePDFsFromItems, resolvePDFFromReader } from "./attachmentResolver";
import { writeClipboard } from "./clipboardWriter";
import type { ClipboardResult, MultiPDFMode } from "./types";

export async function copyFromSelection(
  mode: MultiPDFMode = "all",
  allowPathFallback = true,
): Promise<ClipboardResult> {
  const pane = Zotero.getActiveZoteroPane();
  const items = pane?.getSelectedItems?.() || [];
  const files = await resolvePDFsFromItems(items, mode);
  return writeClipboard(files, allowPathFallback);
}

export async function copyFromReader(
  allowPathFallback = true,
): Promise<ClipboardResult> {
  const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
  if (!reader?.itemID) {
    return { ok: false, format: "none", count: 0, message: "No active reader" };
  }
  const files = await resolvePDFFromReader(reader.itemID);
  return writeClipboard(files, allowPathFallback);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/unit/copy-commands.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/modules/copy/copyCommands.ts src/hooks.ts test/unit/copy-commands.test.ts
git commit -m "feat: add copy command layer"
```

Skill refs: `@test-driven-development`

### Task 7: Implement ReaderHook smart Ctrl+C and fallback shortcut

**Files:**
- Create: `src/modules/copy/readerHook.ts`
- Create: `test/unit/reader-hook.test.ts`
- Modify: `src/hooks.ts`
- Test: `test/unit/reader-hook.test.ts`

**Step 1: Write the failing tests**

```ts
// test/unit/reader-hook.test.ts
import { expect } from "chai";
import { handleReaderCopyShortcut } from "../../src/modules/copy/readerHook";

describe("reader hook", () => {
  it("does not intercept Ctrl+C when selection exists in smart mode", async () => {
    const intercepted = await handleReaderCopyShortcut(mockEvent(true), "smart");
    expect(intercepted).to.equal(false);
  });

  it("intercepts Ctrl+C when selection is empty in smart mode", async () => {
    const intercepted = await handleReaderCopyShortcut(mockEvent(false), "smart");
    expect(intercepted).to.equal(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/unit/reader-hook.test.ts`
Expected: FAIL with missing reader hook module.

**Step 3: Write minimal implementation**

```ts
// src/modules/copy/readerHook.ts
import { copyFromReader } from "./copyCommands";

export type ReaderCtrlCMode = "smart" | "never" | "always";

export async function handleReaderCopyShortcut(
  event: KeyboardEvent,
  mode: ReaderCtrlCMode,
): Promise<boolean> {
  const isCopy = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "c";
  if (!isCopy || mode === "never") return false;

  const hasSelection = hasReaderTextSelection(event.view);
  if (mode === "smart" && hasSelection) return false;

  event.preventDefault();
  await copyFromReader(true);
  return true;
}

function hasReaderTextSelection(win: Window | null): boolean {
  const selection = win?.getSelection?.();
  return !!selection && selection.toString().trim().length > 0;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- test/unit/reader-hook.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/modules/copy/readerHook.ts src/hooks.ts test/unit/reader-hook.test.ts
git commit -m "feat: add smart Ctrl+C reader hook"
```

Skill refs: `@test-driven-development`

### Task 8: Add preferences UI, localization, and notifications

**Files:**
- Modify: `src/modules/preferenceScript.ts`
- Modify: `src/utils/prefs.ts`
- Modify: `addon/content/preferences.xhtml`
- Modify: `addon/locale/en-US/preferences.ftl`
- Modify: `addon/locale/en-US/mainWindow.ftl`
- Create: `src/modules/copy/notifier.ts`
- Create: `test/unit/notifier.test.ts`
- Test: `test/unit/notifier.test.ts`

**Step 1: Write the failing test**

```ts
// test/unit/notifier.test.ts
import { expect } from "chai";
import { formatCopyMessage } from "../../src/modules/copy/notifier";

describe("notifier", () => {
  it("formats fallback message with count", () => {
    const msg = formatCopyMessage({ ok: true, format: "path-text", count: 2 });
    expect(msg).to.equal("File clipboard unavailable. Copied 2 file path(s) instead.");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- test/unit/notifier.test.ts`
Expected: FAIL with missing notifier module.

**Step 3: Write minimal implementation**

```ts
// src/modules/copy/notifier.ts
import type { ClipboardResult } from "./types";

export function formatCopyMessage(result: ClipboardResult): string {
  if (!result.ok) return "Copy failed. Please check file availability and clipboard support in target app.";
  if (result.format === "path-text") {
    return `File clipboard unavailable. Copied ${result.count} file path(s) instead.`;
  }
  return `Copied ${result.count} PDF file(s) to clipboard (${result.format}).`;
}

export function notifyCopyResult(result: ClipboardResult): void {
  Zotero.alert(null, "ZotClip", formatCopyMessage(result));
}
```

**Step 4: Run test and full verification**

Run: `npm test && npm run build && npm run lint:check`
Expected: all commands exit 0.

**Step 5: Commit**

```bash
git add src/modules/preferenceScript.ts src/utils/prefs.ts addon/content/preferences.xhtml addon/locale/en-US/preferences.ftl addon/locale/en-US/mainWindow.ftl src/modules/copy/notifier.ts test/unit/notifier.test.ts
git commit -m "feat: add copy preferences and user notifications"
```

Skill refs: `@verification-before-completion`

### Task 9: Final manual verification and release notes

**Files:**
- Create: `docs/testing/2026-03-05-zotclip-v1-manual-checklist.md`
- Modify: `README.md`
- Test: `docs/testing/2026-03-05-zotclip-v1-manual-checklist.md`

**Step 1: Write manual test checklist**

```md
# ZotClip v1 Manual Checklist

- Copy selected attachment PDF from library and paste into Explorer
- Copy multiple selected item PDFs in `all` mode
- Copy only primary PDF in `primary` mode
- Reader smart Ctrl+C: with selection -> native text copy
- Reader smart Ctrl+C: no selection -> file copy
- Force fallback and verify path-text notification
```

**Step 2: Run packaging verification**

Run: `npm run build`
Expected: plugin package generated without errors.

**Step 3: Update README usage section**

```md
## Usage

- Library: select items or attachments, then run "Copy PDF File(s)"
- Reader: press Ctrl+C with no selection to copy current PDF file
- Configure: set multi-PDF mode and fallback in Preferences -> ZotClip
```

**Step 4: Run final validation**

Run: `npm test && npm run lint:check && npm run build`
Expected: all green.

**Step 5: Commit**

```bash
git add docs/testing/2026-03-05-zotclip-v1-manual-checklist.md README.md
git commit -m "docs: add ZotClip usage and manual verification checklist"
```

Skill refs: `@verification-before-completion`, `@requesting-code-review`

## Notes for Execution

1. Keep each task isolated and complete the commit before moving to the next task.
2. Use dependency injection in tests to avoid hard-coupling to Zotero globals.
3. Prefer removing unused template code instead of preserving backward-compat branches.
4. Use English-only comments/messages in new code and docs.

