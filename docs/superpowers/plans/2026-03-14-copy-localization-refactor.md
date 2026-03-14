# Copy Localization Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the `copy` module so all user-visible copy messages flow through Fluent locale files via stable message keys and args instead of free-form English strings.

**Architecture:** Introduce a typed message contract in the copy pipeline, add a focused formatter that resolves copy-specific message keys through the existing locale utility, and convert diagnostics plus reader/notification surfaces to consume structured descriptors instead of inline localized strings. Remove the transitional `uiStrings.ts` layer entirely once all producers and consumers use the new contract.

**Tech Stack:** TypeScript ESM, Fluent FTL locale files, tsx unit tests, Zotero plugin scaffold

---

## File Map

- Create: `src/modules/copy/copyMessages.ts`
  - Owns typed copy message keys, Fluent rendering helpers, and diagnostics line rendering helpers.
- Modify: `src/modules/copy/types.ts`
  - Replace free-form `message` text with typed `messageKey` and `messageArgs`.
- Modify: `src/modules/copy/clipboard/backends.ts`
  - Convert generic failure/success builders to the structured message contract.
- Modify: `src/modules/copy/clipboardWriter.ts`
  - Emit structured copy messages for empty-file and fallback cases.
- Modify: `src/modules/copy/copyCommands.ts`
  - Emit a structured "no active reader attachment" message.
- Modify: `src/modules/copy/clipboard/backendStatus.ts`
  - Return typed fallback message keys/args rather than English text.
- Modify: `src/modules/copy/clipboard/diagnostics.ts`
  - Return structured diagnostics lines and a Fluent-backed rendering path.
- Modify: `src/utils/prefs.ts`
  - Stop depending on `uiStrings.ts`; wire diagnostics through the new copy message formatter.
- Modify: `src/modules/copy/notifier.ts`
  - Resolve notification copy through Fluent instead of TypeScript language branches.
- Modify: `src/modules/copy/readerToolbarButton.ts`
  - Keep the button state pure, but consume unavailable messages from Fluent-backed producers only.
- Modify: `src/hooks.ts`
  - Ensure reader availability and notification paths use the new message helpers consistently.
- Modify: `addon/locale/en-US/addon.ftl`
  - Add copy notification, reason, and diagnostics message entries.
- Modify: `addon/locale/zh-CN/addon.ftl`
  - Add the corresponding Chinese entries.
- Modify: `typings/i10n.d.ts`
  - Refresh generated locale typings after adding new Fluent keys.
- Delete: `src/modules/copy/uiStrings.ts`
  - Remove the old code-localized English/Chinese message shim.
- Test: `spec/unit/clipboard-writer.test.ts`
- Test: `spec/unit/copy-commands.test.ts`
- Test: `spec/unit/backend-status.test.ts`
- Test: `spec/unit/notifier.test.ts`
- Test: `spec/unit/preference-script.test.ts`
- Test: `spec/unit/reader-toolbar-button.test.ts`

## Chunk 1: Setup and Structured Message Contract

### Task 1: Create an Isolated Worktree and Verify the Baseline

**Files:**
- Modify: `.worktrees/` (new worktree only)

- [ ] **Step 1: Create the isolated worktree**

Run:

```bash
git worktree add .worktrees/refactor-copy-localization -b refactor/copy-localization
```

Expected: git reports a new worktree checked out on branch `refactor/copy-localization`.

- [ ] **Step 2: Install dependencies in the worktree**

Run:

```bash
npm install
```

Working directory: `.worktrees/refactor-copy-localization`

Expected: install completes without dependency resolution errors.

- [ ] **Step 3: Verify the unit-test baseline before touching code**

Run:

```bash
npm run test:unit
```

Expected: PASS. If it fails, stop and surface the failure before implementing.

- [ ] **Step 4: Commit nothing**

There is no code change in this task. Leave the tree clean and proceed.

### Task 2: Replace Free-Form Copy Messages with Typed Message Keys

**Files:**
- Modify: `src/modules/copy/types.ts`
- Modify: `src/modules/copy/clipboard/backends.ts`
- Modify: `src/modules/copy/clipboardWriter.ts`
- Modify: `src/modules/copy/copyCommands.ts`
- Modify: `src/modules/copy/clipboard/backendStatus.ts`
- Test: `spec/unit/clipboard-writer.test.ts`
- Test: `spec/unit/copy-commands.test.ts`
- Test: `spec/unit/backend-status.test.ts`

- [ ] **Step 1: Write the failing contract tests**

Update the tests so they assert typed message keys instead of English text.

Example assertions to add:

```ts
assert.deepEqual(result, {
  ok: false,
  format: "none",
  count: 0,
  outcome: "backend-unavailable",
  messageKey: "copy-no-files",
});
```

```ts
assert.deepEqual(result, {
  ok: false,
  format: "none",
  count: 0,
  messageKey: "copy-reader-no-active",
});
```

```ts
assert.deepEqual(result, {
  activeBackend: BACKEND_IDS.FALLBACK,
  lastFallbackMessageKey: "copy-linux-gtk4-missing",
});
```

- [ ] **Step 2: Run the targeted tests to verify RED**

Run:

```bash
npx tsx --test spec/unit/clipboard-writer.test.ts spec/unit/copy-commands.test.ts spec/unit/backend-status.test.ts
```

Expected: FAIL because production code still returns `message` or `lastFallbackReason`.

- [ ] **Step 3: Introduce the new types in `types.ts`**

Add a constrained message-key union and typed args map.

Target shape:

```ts
export type CopyMessageKey =
  | "copy-no-files"
  | "copy-reader-no-active"
  | "copy-clipboard-write-failed"
  | "copy-path-text-fallback"
  | "copy-linux-gtk4-missing"
  | "copy-linux-wl-copy-missing"
  | "copy-macos-osascript-missing";

export interface ClipboardResult {
  ok: boolean;
  format: ClipboardFormat;
  count: number;
  outcome?: ClipboardOutcome;
  messageKey?: CopyMessageKey;
  messageArgs?: Record<string, string | number>;
}
```

- [ ] **Step 4: Update producers to emit typed messages**

Replace English string returns in:

- `copyCommands.ts`
- `clipboardWriter.ts`
- `clipboard/backends.ts`
- `clipboard/backendStatus.ts`

Use the smallest data needed. Do not keep both `message` and `messageKey`.

- [ ] **Step 5: Re-run the targeted tests to verify GREEN**

Run:

```bash
npx tsx --test spec/unit/clipboard-writer.test.ts spec/unit/copy-commands.test.ts spec/unit/backend-status.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the contract refactor**

Run:

```bash
git add spec/unit/clipboard-writer.test.ts spec/unit/copy-commands.test.ts spec/unit/backend-status.test.ts src/modules/copy/types.ts src/modules/copy/clipboard/backends.ts src/modules/copy/clipboardWriter.ts src/modules/copy/copyCommands.ts src/modules/copy/clipboard/backendStatus.ts
git commit -m "refactor: add structured copy message keys"
```

Expected: one focused commit for the contract change.

## Chunk 2: Fluent Rendering, Diagnostics, and Cleanup

### Task 3: Add a Fluent-Backed Copy Message Formatter

**Files:**
- Create: `src/modules/copy/copyMessages.ts`
- Modify: `src/modules/copy/notifier.ts`
- Modify: `src/hooks.ts`
- Modify: `src/modules/copy/readerToolbarButton.ts`
- Modify: `addon/locale/en-US/addon.ftl`
- Modify: `addon/locale/zh-CN/addon.ftl`
- Test: `spec/unit/notifier.test.ts`
- Test: `spec/unit/reader-toolbar-button.test.ts`

- [ ] **Step 1: Write the failing notification and reader-message tests**

Update notification tests to verify Fluent-backed rendering via keys/args.

Add coverage like:

```ts
assert.equal(
  formatCopyMessage(
    {
      ok: false,
      format: "none",
      count: 0,
      outcome: "dependency-missing",
      messageKey: "copy-linux-wl-copy-missing",
    },
    createTestLocaleDeps("zh-CN"),
  ),
  "要在 Wayland 中启用文件复制，请安装 wl-clipboard。",
);
```

Keep `buildReaderButtonState()` pure, but stop testing inline English copy as protocol. Assert that disabled states preserve the already-rendered localized string provided by callers.

- [ ] **Step 2: Run the targeted tests to verify RED**

Run:

```bash
npx tsx --test spec/unit/notifier.test.ts spec/unit/reader-toolbar-button.test.ts
```

Expected: FAIL because `notifier.ts` still uses language branches and has no Fluent-backed copy formatter.

- [ ] **Step 3: Add the copy message formatter and locale entries**

In `src/modules/copy/copyMessages.ts`, add helpers to:

- map `ClipboardResult` outcomes to locale ids and args
- render copy notifications through `getString()`
- expose focused helpers for diagnostics and reader availability messages when needed

Use locale entries such as:

```ftl
copy-notify-files = Copied { $count } attachment file(s) to clipboard.
copy-notify-files-file-object = Copied { $count } attachment file(s) to clipboard (file-object).
copy-notify-file-uris = Copied { $count } attachment file URI(s) to clipboard.
copy-no-files = No files to copy.
copy-reader-no-active = No active reader attachment.
copy-linux-wl-copy-missing = Install wl-clipboard to enable file copy on Wayland.
```

Add matching Chinese translations in `addon/locale/zh-CN/addon.ftl`.

- [ ] **Step 4: Refactor notifier and hook consumers**

Update `notifier.ts` to render messages via `copyMessages.ts`. Keep its public API unchanged if possible:

```ts
export function formatCopyMessage(
  result: ClipboardResult,
  deps: CopyMessageRenderDeps = {},
): string
```

Update hook-side reader availability producers to pass locale-rendered messages from the same helper layer instead of duplicating string choices.

- [ ] **Step 5: Refresh locale typings and re-run tests**

Run:

```bash
npm run build
npx tsx --test spec/unit/notifier.test.ts spec/unit/reader-toolbar-button.test.ts
```

Expected: build regenerates locale typings and both targeted tests PASS.

- [ ] **Step 6: Commit the Fluent formatter task**

Run:

```bash
git add src/modules/copy/copyMessages.ts src/modules/copy/notifier.ts src/hooks.ts src/modules/copy/readerToolbarButton.ts addon/locale/en-US/addon.ftl addon/locale/zh-CN/addon.ftl typings/i10n.d.ts spec/unit/notifier.test.ts spec/unit/reader-toolbar-button.test.ts
git commit -m "refactor: move copy notifications to Fluent"
```

### Task 4: Convert Diagnostics to Structured Descriptors and Fluent Rendering

**Files:**
- Modify: `src/modules/copy/clipboard/diagnostics.ts`
- Modify: `src/utils/prefs.ts`
- Modify: `src/modules/copy/copyMessages.ts`
- Modify: `addon/locale/en-US/addon.ftl`
- Modify: `addon/locale/zh-CN/addon.ftl`
- Test: `spec/unit/preference-script.test.ts`

- [ ] **Step 1: Write the failing diagnostics tests**

Change diagnostics tests so they assert structured descriptors first, then rendered lines.

Add expectations similar to:

```ts
assert.deepEqual(diagnostics.lines[0], {
  key: "copy-diagnostics-platform-linux",
  args: { session: "wayland" },
});
```

```ts
assert.equal(
  renderCopyDiagnosticsLine(diagnostics.lines[0], createTestLocaleDeps("en-US")),
  "Platform: linux (wayland)",
);
```

- [ ] **Step 2: Run the targeted diagnostics test to verify RED**

Run:

```bash
npx tsx --test spec/unit/preference-script.test.ts
```

Expected: FAIL because diagnostics still return rendered strings and depend on `uiStrings.ts`.

- [ ] **Step 3: Refactor diagnostics to emit descriptors**

Introduce a typed descriptor shape in `clipboard/diagnostics.ts`, for example:

```ts
export interface CopyDiagnosticsLine {
  key: CopyMessageKey;
  args?: Record<string, string | number>;
}
```

Update `buildClipboardDiagnostics()` to return `lines: CopyDiagnosticsLine[]` and use `lastFallbackMessageKey` instead of `lastFallbackReason`.

- [ ] **Step 4: Render diagnostics through the copy message formatter**

In `copyMessages.ts`, add a helper such as:

```ts
export function renderCopyDiagnosticsLine(
  line: CopyDiagnosticsLine,
  deps?: CopyMessageRenderDeps,
): string
```

Update `src/utils/prefs.ts` to build diagnostics using the new data path and only render at the UI boundary.

- [ ] **Step 5: Add diagnostics locale entries and verify GREEN**

Run:

```bash
npm run build
npx tsx --test spec/unit/preference-script.test.ts
```

Expected: PASS with diagnostics using Fluent-backed output.

- [ ] **Step 6: Commit the diagnostics refactor**

Run:

```bash
git add src/modules/copy/clipboard/diagnostics.ts src/utils/prefs.ts src/modules/copy/copyMessages.ts addon/locale/en-US/addon.ftl addon/locale/zh-CN/addon.ftl typings/i10n.d.ts spec/unit/preference-script.test.ts
git commit -m "refactor: localize clipboard diagnostics via Fluent"
```

### Task 5: Remove the Transitional Localization Layer and Run Full Verification

**Files:**
- Delete: `src/modules/copy/uiStrings.ts`
- Modify: any import sites still referencing `uiStrings.ts`
- Test: all touched unit tests

- [ ] **Step 1: Write the final failing cleanup check**

Search for remaining imports and message-text fallbacks:

```bash
rg -n "uiStrings|message: \\\"|lastFallbackReason|localizeKnownCopyMessage|getCurrentLanguageTag" src spec/unit
```

Expected before cleanup: matches remain.

- [ ] **Step 2: Remove `uiStrings.ts` and remaining legacy imports**

Delete `src/modules/copy/uiStrings.ts` and replace import sites with:

- `copyMessages.ts` helpers
- existing `getString()` calls where appropriate

Also remove any lingering `message` or `lastFallbackReason` fields from types and tests.

- [ ] **Step 3: Verify the cleanup search goes green**

Run:

```bash
rg -n "uiStrings|message: \\\"|lastFallbackReason|localizeKnownCopyMessage|getCurrentLanguageTag" src spec/unit
```

Expected: no matches.

- [ ] **Step 4: Run the complete verification suite**

Run:

```bash
npm run test:unit
npm run build
npm run lint:check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the final cleanup**

Run:

```bash
git add src/modules/copy src/utils/prefs.ts addon/locale/en-US/addon.ftl addon/locale/zh-CN/addon.ftl typings/i10n.d.ts spec/unit docs/superpowers/specs/2026-03-14-copy-localization-refactor-design.md docs/superpowers/plans/2026-03-14-copy-localization-refactor.md
git rm src/modules/copy/uiStrings.ts
git commit -m "refactor: unify copy localization through Fluent"
```

## Review Checkpoints

- After Task 2: inspect the diff to confirm no free-form English messages remain in the result contract.
- After Task 3: inspect locale entries and notifier rendering together to confirm no TypeScript language branching remains.
- After Task 4: inspect diagnostics output paths to confirm rendering happens only at the UI boundary.
- After Task 5: request a code review before merging or cleaning up the branch.

## Execution Notes

- Do not start implementation on `main`; execute this plan from the isolated worktree branch.
- Follow TDD strictly: every production change must be preceded by a failing targeted test.
- If `npm run build` does not refresh `typings/i10n.d.ts`, update the file in the same task and note the generation gap before proceeding.
