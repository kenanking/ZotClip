# ZotClip Cross-Platform Clipboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor ZotClip into a cross-platform clipboard plugin that keeps Windows native file copy stable, adds Linux X11/Wayland and macOS command backends, moves reader copy to a toolbar button, and makes shortcuts user-configurable.

**Architecture:** Split the current copy flow into attachment resolution, payload construction, backend selection, and clipboard execution. Keep Windows `CF_HDROP` as the native reference path, add POSIX command backends behind a registry, and drive library/reader UX through shared shortcut and diagnostics modules.

**Tech Stack:** TypeScript ESM, Zotero plugin scaffold, Firefox/XUL UI, `Subprocess.sys.mjs` command execution, `node:test` via `tsx`, system commands (`wl-copy`, `xclip`, `osascript`)

---

## Scope Notes

- This plan covers the first shipping cross-platform milestone:
  - Windows native backend parity
  - Linux X11/Wayland command backends
  - macOS `osascript` file-copy backend
  - reader toolbar button
  - configurable library/reader shortcuts
  - diagnostics and docs
- Linux/macOS native helper binaries are explicitly out of scope for this plan.
  If manual verification shows command backends are insufficient for critical
  targets, write a separate spec and plan for helper-based backends.
- Follow `@superpowers/test-driven-development` per task.
- Before claiming the branch is complete, follow
  `@superpowers/verification-before-completion`.

## File Map

### Existing files to modify

- `src/modules/copy/types.ts`
  - Expand the shared copy result model and keep attachment-level types stable.
- `src/modules/copy/clipboardWriter.ts`
  - Convert from format-switch logic into the orchestrator entry point, or
    replace with a thin wrapper around the new orchestrator.
- `src/modules/copy/copyCommands.ts`
  - Build payload inputs and call the orchestrator for library/reader actions.
- `src/modules/copy/selectionHook.ts`
  - Match a configurable library shortcut instead of hard-coded `Ctrl+C`.
- `src/modules/copy/readerHook.ts`
  - Stop default `Ctrl+C` interception and only match a configured reader
    shortcut.
- `src/modules/copy/notifier.ts`
  - Format structured backend results and fallback/dependency messages.
- `src/modules/copy/menuCommands.ts`
  - Keep menu actions but update labels/tooltips if shortcut text is shown.
- `src/modules/preferenceScript.ts`
  - Replace reader mode handling with shortcut recording/validation and
    diagnostics rendering.
- `src/utils/prefs.ts`
  - Add shortcut getters/setters and platform diagnostics helpers.
- `src/hooks.ts`
  - Register the new reader toolbar button and updated shortcut handlers.
- `addon/prefs.js`
  - Replace `readerCtrlCMode` with shortcut preferences.
- `addon/content/preferences.xhtml`
  - Add library/reader shortcut controls and diagnostics UI.
- `addon/locale/en-US/preferences.ftl`
  - Add localized shortcut and diagnostics strings.
- `addon/locale/zh-CN/preferences.ftl`
  - Add localized shortcut and diagnostics strings.
- `addon/locale/en-US/mainWindow.ftl`
  - Add reader toolbar button label/tooltip strings.
- `addon/locale/zh-CN/mainWindow.ftl`
  - Add reader toolbar button label/tooltip strings.
- `typings/prefs.d.ts`
  - Add new preference keys.
- `docs/manual-testing.md`
  - Expand to Windows, Linux X11, Linux Wayland, and macOS verification.
- `README.md`
  - Update supported platforms, reader UX, and dependency notes.

### New files to create

- `src/modules/copy/clipboard/types.ts`
  - Clipboard payload, backend availability, diagnostic, and result types.
- `src/modules/copy/clipboard/payload.ts`
  - Build normalized clipboard payloads from resolved attachments.
- `src/modules/copy/clipboard/platformDetection.ts`
  - Detect Windows/Linux/macOS and Linux session type.
- `src/modules/copy/clipboard/commandRunner.ts`
  - Wrap `Subprocess.sys.mjs` and support command probing plus stdin payloads.
- `src/modules/copy/clipboard/backends.ts`
  - Backend interfaces and shared helpers.
- `src/modules/copy/clipboard/backendRegistry.ts`
  - Choose and execute candidate backends in priority order.
- `src/modules/copy/clipboard/windowsBackend.ts`
  - Wrap existing `CF_HDROP` support as a backend.
- `src/modules/copy/clipboard/pathTextBackend.ts`
  - Final cross-platform fallback backend.
- `src/modules/copy/clipboard/linuxCommandBackends.ts`
  - X11 and Wayland command backends.
- `src/modules/copy/clipboard/macosCommandBackend.ts`
  - `osascript` backend that writes file objects to the macOS clipboard.
- `src/modules/copy/clipboard/diagnostics.ts`
  - Build user-facing backend diagnostics data.
- `src/modules/copy/shortcuts.ts`
  - Parse, normalize, format, and match shortcuts.
- `src/modules/copy/readerToolbarButton.ts`
  - Inject/remove/update the reader toolbar button and its enabled state.
- `spec/unit/clipboard-payload.test.ts`
- `spec/unit/platform-detection.test.ts`
- `spec/unit/backend-registry.test.ts`
- `spec/unit/command-runner.test.ts`
- `spec/unit/linux-command-backends.test.ts`
- `spec/unit/macos-command-backend.test.ts`
- `spec/unit/shortcuts.test.ts`
- `spec/unit/reader-toolbar-button.test.ts`

## Chunk 1: Clipboard Foundation

### Task 1: Add Clipboard Payload and Result Types

**Files:**

- Create: `src/modules/copy/clipboard/types.ts`
- Create: `src/modules/copy/clipboard/payload.ts`
- Modify: `src/modules/copy/types.ts`
- Test: `spec/unit/clipboard-payload.test.ts`

- [ ] **Step 1: Write the failing payload builder test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildClipboardPayload } from "../../src/modules/copy/clipboard/payload";

test("buildClipboardPayload returns unique paths, file URIs, and path text", () => {
  const payload = buildClipboardPayload(
    [
      { itemID: 1, attachmentID: 11, path: "C:\\Docs\\a.pdf" },
      { itemID: 1, attachmentID: 12, path: "C:\\Docs\\a.pdf" },
      { itemID: 2, attachmentID: 13, path: "/home/user/book.epub" },
    ],
    "library",
  );

  assert.deepEqual(payload.paths, ["C:\\Docs\\a.pdf", "/home/user/book.epub"]);
  assert.deepEqual(payload.fileUris, [
    "file:///C:/Docs/a.pdf",
    "file:///home/user/book.epub",
  ]);
  assert.equal(payload.pathText, "C:\\Docs\\a.pdf\n/home/user/book.epub");
  assert.equal(payload.operation, "copy");
  assert.equal(payload.source, "library");
});
```

- [ ] **Step 2: Run the payload test to verify it fails**

Run: `npx tsx --test spec/unit/clipboard-payload.test.ts`

Expected: FAIL with a module-not-found or missing-export error for
`buildClipboardPayload`.

- [ ] **Step 3: Add the clipboard payload/result types**

```ts
// src/modules/copy/clipboard/types.ts
export type ClipboardSource = "library" | "reader";

export interface ClipboardPayload {
  paths: string[];
  fileUris: string[];
  pathText: string;
  operation: "copy";
  source: ClipboardSource;
}

export interface BackendAvailability {
  available: boolean;
  reason?: string;
  dependency?: string;
}
```

- [ ] **Step 4: Implement the payload builder**

```ts
// src/modules/copy/clipboard/payload.ts
import type { ResolvedAttachment } from "../types";
import type { ClipboardPayload, ClipboardSource } from "./types";

export function buildClipboardPayload(
  files: ResolvedAttachment[],
  source: ClipboardSource,
): ClipboardPayload {
  const paths = Array.from(
    new Set(files.map((file) => file.path.trim()).filter(Boolean)),
  );

  return {
    paths,
    fileUris: paths.map((path) => pathToFileUri(path)),
    pathText: paths.join("\n"),
    operation: "copy",
    source,
  };
}
```

- [ ] **Step 5: Extend the shared result model in `src/modules/copy/types.ts`**

```ts
export type ClipboardFormat =
  | "file-object"
  | "file-uri-list"
  | "path-text"
  | "none";

export type ClipboardOutcome =
  | "copied-files"
  | "copied-file-uris"
  | "copied-path-text-fallback"
  | "backend-unavailable"
  | "dependency-missing"
  | "copy-failed";
```

- [ ] **Step 6: Run the payload test to verify it passes**

Run: `npx tsx --test spec/unit/clipboard-payload.test.ts`

Expected: PASS with `1 test passed`.

- [ ] **Step 7: Commit the payload foundation**

```bash
git add src/modules/copy/types.ts src/modules/copy/clipboard/types.ts src/modules/copy/clipboard/payload.ts spec/unit/clipboard-payload.test.ts
git commit -m "feat: add clipboard payload model"
```

### Task 2: Add Platform Detection

**Files:**

- Create: `src/modules/copy/clipboard/platformDetection.ts`
- Test: `spec/unit/platform-detection.test.ts`

- [ ] **Step 1: Write the failing platform detection tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { detectPlatformContext } from "../../src/modules/copy/clipboard/platformDetection";

test("detectPlatformContext returns wayland when WAYLAND_DISPLAY is set", () => {
  const result = detectPlatformContext({
    isLinux: true,
    env: { WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":1" },
  });

  assert.equal(result.platform, "linux");
  assert.equal(result.linuxSession, "wayland");
});

test("detectPlatformContext returns x11 when DISPLAY is set without WAYLAND_DISPLAY", () => {
  const result = detectPlatformContext({
    isLinux: true,
    env: { DISPLAY: ":0" },
  });

  assert.equal(result.platform, "linux");
  assert.equal(result.linuxSession, "x11");
});
```

- [ ] **Step 2: Run the platform tests to verify they fail**

Run: `npx tsx --test spec/unit/platform-detection.test.ts`

Expected: FAIL with a module-not-found or missing-export error for
`detectPlatformContext`.

- [ ] **Step 3: Implement the platform detection module**

```ts
export interface PlatformContext {
  platform: "windows" | "linux" | "macos";
  linuxSession?: "x11" | "wayland" | "unknown";
}

export function detectPlatformContext(input: {
  isWin?: boolean;
  isLinux?: boolean;
  isMac?: boolean;
  env?: Record<string, string | undefined>;
}): PlatformContext {
  if (input.isWin) {
    return { platform: "windows" };
  }

  if (input.isMac) {
    return { platform: "macos" };
  }

  const env = input.env || {};
  if (env.WAYLAND_DISPLAY) {
    return { platform: "linux", linuxSession: "wayland" };
  }
  if (env.DISPLAY) {
    return { platform: "linux", linuxSession: "x11" };
  }
  return { platform: "linux", linuxSession: "unknown" };
}
```

- [ ] **Step 4: Add the production env adapter**

Use `Services.env.get("WAYLAND_DISPLAY")`, `Services.env.get("DISPLAY")`, and
`Zotero.isWin` / `Zotero.isLinux` / `Zotero.isMac` in the production entry
point, but keep the pure function injectable for tests.

- [ ] **Step 5: Run the platform tests to verify they pass**

Run: `npx tsx --test spec/unit/platform-detection.test.ts`

Expected: PASS with `2 tests passed`.

- [ ] **Step 6: Commit the platform detection task**

```bash
git add src/modules/copy/clipboard/platformDetection.ts spec/unit/platform-detection.test.ts
git commit -m "feat: detect clipboard platform context"
```

### Task 3: Add Backend Interfaces, Registry, and Windows/Path-Text Backends

**Files:**

- Create: `src/modules/copy/clipboard/backends.ts`
- Create: `src/modules/copy/clipboard/backendRegistry.ts`
- Create: `src/modules/copy/clipboard/windowsBackend.ts`
- Create: `src/modules/copy/clipboard/pathTextBackend.ts`
- Modify: `src/modules/copy/windowsFileClipboard.ts`
- Test: `spec/unit/backend-registry.test.ts`
- Test: `spec/unit/windows-file-clipboard.test.ts`

- [ ] **Step 1: Write the failing backend registry tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { runClipboardBackends } from "../../src/modules/copy/clipboard/backendRegistry";

test("runClipboardBackends picks the first successful backend by priority", async () => {
  const result = await runClipboardBackends({
    payload: {
      paths: ["C:\\Docs\\a.pdf"],
      fileUris: ["file:///C:/Docs/a.pdf"],
      pathText: "C:\\Docs\\a.pdf",
      operation: "copy",
      source: "library",
    },
    backends: [
      {
        id: "unavailable",
        priority: 100,
        isAvailable: async () => ({ available: false, reason: "missing" }),
        write: async () => {
          throw new Error("should not run");
        },
      },
      {
        id: "fallback",
        priority: 10,
        isAvailable: async () => ({ available: true }),
        write: async () => ({
          ok: true,
          count: 1,
          format: "path-text",
          outcome: "copied-path-text-fallback",
        }),
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.outcome, "copied-path-text-fallback");
});
```

- [ ] **Step 2: Run the registry test to verify it fails**

Run: `npx tsx --test spec/unit/backend-registry.test.ts`

Expected: FAIL with a module-not-found or missing-export error for
`runClipboardBackends`.

- [ ] **Step 3: Add the backend interface module**

```ts
export interface ClipboardBackend {
  id: string;
  priority: number;
  isAvailable(payload: ClipboardPayload): Promise<BackendAvailability>;
  write(payload: ClipboardPayload): Promise<ClipboardResult>;
}
```

- [ ] **Step 4: Implement the registry runner**

```ts
export async function runClipboardBackends(input: {
  payload: ClipboardPayload;
  backends: ClipboardBackend[];
}): Promise<ClipboardResult> {
  const ordered = [...input.backends].sort((a, b) => b.priority - a.priority);

  for (const backend of ordered) {
    const availability = await backend.isAvailable(input.payload);
    if (!availability.available) {
      continue;
    }

    const result = await backend.write(input.payload);
    if (result.ok) {
      return result;
    }
  }

  return {
    ok: false,
    count: input.payload.paths.length,
    format: "none",
    outcome: "copy-failed",
    message: "Clipboard write failed.",
  };
}
```

- [ ] **Step 5: Wrap the current Windows implementation in a backend**

Keep `buildDropFilesPayload()` and `writeWindowsFileDrop()` intact, but create a
backend that returns:

```ts
{
  ok: true,
  count: payload.paths.length,
  format: "file-object",
  outcome: "copied-files",
}
```

when `writeWindowsFileDrop(payload.paths)` succeeds.

- [ ] **Step 6: Add the path-text backend**

Use `Zotero.Utilities.Internal.copyTextToClipboard(payload.pathText)` behind a
backend with the lowest priority and return `copied-path-text-fallback`.

- [ ] **Step 7: Run registry and Windows payload tests**

Run: `npx tsx --test spec/unit/backend-registry.test.ts spec/unit/windows-file-clipboard.test.ts`

Expected: PASS with all tests green.

- [ ] **Step 8: Commit the backend foundation**

```bash
git add src/modules/copy/clipboard/backends.ts src/modules/copy/clipboard/backendRegistry.ts src/modules/copy/clipboard/windowsBackend.ts src/modules/copy/clipboard/pathTextBackend.ts src/modules/copy/windowsFileClipboard.ts spec/unit/backend-registry.test.ts spec/unit/windows-file-clipboard.test.ts
git commit -m "feat: add clipboard backend registry"
```

### Task 4: Migrate the Copy Flow to the Orchestrator

**Files:**

- Modify: `src/modules/copy/clipboardWriter.ts`
- Modify: `src/modules/copy/copyCommands.ts`
- Modify: `src/modules/copy/notifier.ts`
- Modify: `spec/unit/clipboard-writer.test.ts`
- Modify: `spec/unit/copy-commands.test.ts`

- [ ] **Step 1: Write the failing orchestrator tests**

Extend `spec/unit/clipboard-writer.test.ts` so one test asserts that a Windows
platform uses the registry-provided `windows-native` backend and another test
asserts that empty payloads return:

```ts
{
  ok: false,
  format: "none",
  outcome: "backend-unavailable",
  count: 0,
}
```

- [ ] **Step 2: Run the clipboard writer and copy command tests to verify they fail**

Run: `npx tsx --test spec/unit/clipboard-writer.test.ts spec/unit/copy-commands.test.ts`

Expected: FAIL because the old `writeClipboard()` result shape no longer matches
the tests.

- [ ] **Step 3: Convert `clipboardWriter.ts` into the orchestrator entry point**

Implement a structure like:

```ts
const payload = buildClipboardPayload(files, source);
if (!payload.paths.length) {
  return emptyResult(source);
}

const backends = buildClipboardBackends(platformContext, deps);
return runClipboardBackends({ payload, backends });
```

- [ ] **Step 4: Update copy command call sites to pass the source**

`copyFromSelection()` should call `writeClipboard(files, "library")`.

`copyFromReader()` should call `writeClipboard(files, "reader")`.

- [ ] **Step 5: Update notification formatting**

Map `ClipboardOutcome` values to stable user-facing strings. Keep backend IDs
out of user-visible notifications.

- [ ] **Step 6: Run the orchestrator-related tests**

Run: `npx tsx --test spec/unit/clipboard-writer.test.ts spec/unit/copy-commands.test.ts`

Expected: PASS with all tests green.

- [ ] **Step 7: Commit the orchestrator migration**

```bash
git add src/modules/copy/clipboardWriter.ts src/modules/copy/copyCommands.ts src/modules/copy/notifier.ts spec/unit/clipboard-writer.test.ts spec/unit/copy-commands.test.ts
git commit -m "refactor: route copy flow through clipboard orchestrator"
```

## Chunk 2: Shortcuts and Reader UX

### Task 5: Replace Reader Mode Prefs with Shortcut Prefs

**Files:**

- Modify: `addon/prefs.js`
- Modify: `typings/prefs.d.ts`
- Modify: `src/utils/prefs.ts`
- Modify: `src/hooks.ts`
- Test: `spec/unit/preference-script.test.ts`

- [ ] **Step 1: Write the failing preference tests**

Add tests for:

- `getLibraryShortcut()` defaulting to `Ctrl+C`
- `getReaderShortcut()` defaulting to `""`
- legacy `readerCtrlCMode = "always"` mapping once to `Ctrl+Shift+C`

Example:

```ts
test("prefs map legacy reader always mode to Ctrl+Shift+C once", () => {
  const migrated = migrateLegacyShortcutPrefs({
    readerCtrlCMode: "always",
    readerShortcut: "",
  });

  assert.equal(migrated.readerShortcut, "Ctrl+Shift+C");
});
```

- [ ] **Step 2: Run the preference test file to verify it fails**

Run: `npx tsx --test spec/unit/preference-script.test.ts`

Expected: FAIL because the shortcut helpers and migration do not exist yet.

- [ ] **Step 3: Replace the stored preference schema**

Update `addon/prefs.js` and `typings/prefs.d.ts` to use:

```ts
pref("libraryShortcut", "Ctrl+C");
pref("readerShortcut", "");
```

Remove `readerCtrlCMode` from the active schema.

- [ ] **Step 4: Add pref getters and a one-time legacy migration helper**

Implement in `src/utils/prefs.ts`:

```ts
export function getLibraryShortcut(): string {
  return (getPref("libraryShortcut") || "Ctrl+C").trim();
}

export function getReaderShortcut(): string {
  return (getPref("readerShortcut") || "").trim();
}
```

Map the legacy `"always"` reader mode to `Ctrl+Shift+C`; map `"smart"` and
`"never"` to empty.

- [ ] **Step 5: Call the migration helper during startup**

Add the migration call near the top of `onStartup()` before registering window
hooks.

- [ ] **Step 6: Run the preference tests again**

Run: `npx tsx --test spec/unit/preference-script.test.ts`

Expected: PASS with the new shortcut-pref tests green.

- [ ] **Step 7: Commit the preference schema task**

```bash
git add addon/prefs.js typings/prefs.d.ts src/utils/prefs.ts src/hooks.ts spec/unit/preference-script.test.ts
git commit -m "feat: replace reader mode prefs with shortcut prefs"
```

### Task 6: Add Shared Shortcut Parsing and Matching

**Files:**

- Create: `src/modules/copy/shortcuts.ts`
- Test: `spec/unit/shortcuts.test.ts`
- Modify: `spec/unit/keyboard-shortcuts.test.ts`
- Modify: `src/modules/copy/selectionHook.ts`
- Modify: `src/modules/copy/readerHook.ts`

- [ ] **Step 1: Write the failing shortcut parser tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  formatShortcut,
  matchesShortcut,
  parseShortcut,
} from "../../src/modules/copy/shortcuts";

test("parseShortcut normalizes modifier ordering", () => {
  assert.deepEqual(parseShortcut("shift+ctrl+c"), {
    alt: false,
    ctrlOrMeta: true,
    key: "c",
    shift: true,
  });
});

test("matchesShortcut accepts Ctrl on Windows and Meta on macOS", () => {
  const shortcut = parseShortcut("Ctrl+C");
  assert.equal(
    matchesShortcut(shortcut, {
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      key: "c",
    } as KeyboardEvent),
    true,
  );
  assert.equal(
    matchesShortcut(shortcut, {
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      shiftKey: false,
      key: "c",
    } as KeyboardEvent),
    true,
  );
});
```

- [ ] **Step 2: Run the shortcut tests to verify they fail**

Run: `npx tsx --test spec/unit/shortcuts.test.ts spec/unit/keyboard-shortcuts.test.ts`

Expected: FAIL with a missing shortcut module or stale hard-coded key logic.

- [ ] **Step 3: Implement `parseShortcut()`, `formatShortcut()`, and `matchesShortcut()`**

Normalize shortcuts to:

```ts
export interface ParsedShortcut {
  ctrlOrMeta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}
```

Treat an empty string as a disabled shortcut.

- [ ] **Step 4: Rewire the library shortcut hook**

Replace the current hard-coded `Ctrl+C` detection in
`selectionHook.ts` with `matchesShortcut(parseShortcut(shortcut), event)`,
while preserving editable-target and selected-item guards.

- [ ] **Step 5: Rewire the reader shortcut hook**

Only intercept when:

- reader context is active
- the configured reader shortcut is non-empty
- the event matches the configured shortcut

Default `Ctrl+C` must remain untouched.

- [ ] **Step 6: Run the shortcut-related tests**

Run: `npx tsx --test spec/unit/shortcuts.test.ts spec/unit/keyboard-shortcuts.test.ts`

Expected: PASS with all shortcut tests green.

- [ ] **Step 7: Commit the shortcut module task**

```bash
git add src/modules/copy/shortcuts.ts src/modules/copy/selectionHook.ts src/modules/copy/readerHook.ts spec/unit/shortcuts.test.ts spec/unit/keyboard-shortcuts.test.ts
git commit -m "feat: add configurable shortcut matching"
```

### Task 7: Add the Reader Toolbar Button

**Files:**

- Create: `src/modules/copy/readerToolbarButton.ts`
- Modify: `src/hooks.ts`
- Test: `spec/unit/reader-toolbar-button.test.ts`

- [ ] **Step 1: Write the failing reader toolbar tests**

Cover two pure behaviors:

- tooltip text includes the formatted shortcut when `readerShortcut` is set
- disabled state is applied when `canCopy` is false

Example:

```ts
test("buildReaderButtonState appends the shortcut to the tooltip", () => {
  const state = buildReaderButtonState({
    canCopy: true,
    shortcutLabel: "Ctrl+Shift+C",
    label: "Copy Current Reader Attachment",
  });

  assert.match(state.tooltipText, /Ctrl\+Shift\+C/);
});
```

- [ ] **Step 2: Run the reader toolbar tests to verify they fail**

Run: `npx tsx --test spec/unit/reader-toolbar-button.test.ts`

Expected: FAIL with a module-not-found error for `readerToolbarButton.ts`.

- [ ] **Step 3: Implement the reader toolbar module**

Create helpers for:

- finding the reader toolbar container
- creating a single ZotClip button with a dataset marker
- updating `disabled`, `title`, and localized label
- removing the button on window unload

Keep DOM selection isolated in this file so changing reader selectors later only
touches one module.

- [ ] **Step 4: Add a pure reader-copy eligibility adapter**

Expose a small function that returns:

```ts
{
  canCopy: boolean;
  message?: string;
}
```

based on the active reader item, allowed attachment types, and local file
availability. Use that to drive the button state instead of duplicating checks
in the click handler.

- [ ] **Step 5: Register and dispose the button from `src/hooks.ts`**

Mirror the existing window lifecycle pattern used for shortcut disposers.

- [ ] **Step 6: Run the toolbar tests**

Run: `npx tsx --test spec/unit/reader-toolbar-button.test.ts`

Expected: PASS with all toolbar tests green.

- [ ] **Step 7: Commit the reader toolbar task**

```bash
git add src/modules/copy/readerToolbarButton.ts src/hooks.ts spec/unit/reader-toolbar-button.test.ts
git commit -m "feat: add reader toolbar copy button"
```

### Task 8: Update Preferences UI, Locale Strings, and Menu Text

**Files:**

- Modify: `addon/content/preferences.xhtml`
- Modify: `src/modules/preferenceScript.ts`
- Modify: `addon/locale/en-US/preferences.ftl`
- Modify: `addon/locale/zh-CN/preferences.ftl`
- Modify: `addon/locale/en-US/mainWindow.ftl`
- Modify: `addon/locale/zh-CN/mainWindow.ftl`
- Modify: `src/modules/copy/menuCommands.ts`
- Modify: `spec/unit/preference-script.test.ts`

- [ ] **Step 1: Write the failing preference UI tests**

Add tests for:

- shortcut normalization from the preference form
- inline validation on invalid shortcuts
- empty reader shortcut storing as disabled

Example:

```ts
test("preference script normalizes shortcut input", () => {
  assert.equal(normalizeShortcutInput(" shift + ctrl + c "), "Ctrl+Shift+C");
});
```

- [ ] **Step 2: Run the preference-script tests to verify they fail**

Run: `npx tsx --test spec/unit/preference-script.test.ts`

Expected: FAIL because the new shortcut helpers and validation hooks are not yet
wired.

- [ ] **Step 3: Replace the reader mode controls with shortcut controls**

In `preferences.xhtml`:

- add `libraryShortcut` recorder/input
- add `readerShortcut` recorder/input
- add clear buttons or a clear affordance
- add a diagnostics section placeholder

- [ ] **Step 4: Update `preferenceScript.ts` to persist shortcuts and show validation**

Keep the existing attachment-type logic intact. Add focused helpers for:

- normalizing shortcut strings
- handling keydown capture in the preference inputs
- writing `libraryShortcut` and `readerShortcut`
- showing validation and conflict warnings

- [ ] **Step 5: Update locale strings and reader tooltip text**

Add strings for:

- library shortcut label/help
- reader shortcut label/help
- diagnostics heading and dependency messages
- reader toolbar button tooltip variants

- [ ] **Step 6: Run the preference tests again**

Run: `npx tsx --test spec/unit/preference-script.test.ts`

Expected: PASS with the shortcut-preference tests green.

- [ ] **Step 7: Commit the preference UI task**

```bash
git add addon/content/preferences.xhtml src/modules/preferenceScript.ts addon/locale/en-US/preferences.ftl addon/locale/zh-CN/preferences.ftl addon/locale/en-US/mainWindow.ftl addon/locale/zh-CN/mainWindow.ftl src/modules/copy/menuCommands.ts spec/unit/preference-script.test.ts
git commit -m "feat: add shortcut controls to preferences"
```

## Chunk 3: POSIX Backends and Diagnostics

### Task 9: Add the POSIX Command Runner

**Files:**

- Create: `src/modules/copy/clipboard/commandRunner.ts`
- Test: `spec/unit/command-runner.test.ts`

- [ ] **Step 1: Write the failing command runner tests**

Add tests for:

- building a `command -v` probe on POSIX
- passing stdin text to a process invocation
- surfacing `exitCode`, `stdout`, and `stderr`

Example:

```ts
test("buildProbeCommand uses command -v on POSIX", () => {
  assert.deepEqual(buildProbeCommand("wl-copy"), {
    command: "/bin/sh",
    args: ["-lc", "command -v -- wl-copy"],
  });
});
```

- [ ] **Step 2: Run the command runner tests to verify they fail**

Run: `npx tsx --test spec/unit/command-runner.test.ts`

Expected: FAIL with a missing module error for `commandRunner.ts`.

- [ ] **Step 3: Implement a thin `Subprocess.sys.mjs` wrapper**

Expose:

```ts
runCommand({ command, args, stdinText }): Promise<{
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}>
```

and

```ts
probeCommand(name: string): Promise<boolean>
```

using `/bin/sh -lc "command -v -- <name>"` on POSIX.

- [ ] **Step 4: Keep the module dependency-injected**

Do not bind tests directly to `Subprocess`. Inject the low-level process call so
unit tests can stay pure and deterministic.

- [ ] **Step 5: Run the command runner tests again**

Run: `npx tsx --test spec/unit/command-runner.test.ts`

Expected: PASS with the command-runner tests green.

- [ ] **Step 6: Commit the command runner task**

```bash
git add src/modules/copy/clipboard/commandRunner.ts spec/unit/command-runner.test.ts
git commit -m "feat: add subprocess command runner"
```

### Task 10: Implement Linux X11 and Wayland Command Backends

**Files:**

- Create: `src/modules/copy/clipboard/linuxCommandBackends.ts`
- Modify: `src/modules/copy/clipboard/backendRegistry.ts`
- Modify: `src/modules/copy/clipboard/platformDetection.ts`
- Test: `spec/unit/linux-command-backends.test.ts`
- Modify: `spec/unit/backend-registry.test.ts`

- [ ] **Step 1: Write the failing Linux backend tests**

Cover:

- X11 prefers `xclip` and writes `text/uri-list`
- Wayland prefers `wl-copy` and writes `text/uri-list`
- unavailable command dependencies return `dependency-missing`

Example:

```ts
test("linux x11 backend uses xclip with text/uri-list", async () => {
  const calls: any[] = [];
  const backend = createLinuxX11Backend({
    probeCommand: async (name) => name === "xclip",
    runCommand: async (call) => {
      calls.push(call);
      return { ok: true, exitCode: 0, stdout: "", stderr: "" };
    },
  });

  const result = await backend.write({
    paths: ["/home/user/a.pdf"],
    fileUris: ["file:///home/user/a.pdf"],
    pathText: "/home/user/a.pdf",
    operation: "copy",
    source: "library",
  });

  assert.equal(result.outcome, "copied-file-uris");
  assert.deepEqual(calls[0].args, [
    "-selection",
    "clipboard",
    "-t",
    "text/uri-list",
    "-silent",
    "-i",
  ]);
});
```

- [ ] **Step 2: Run the Linux backend tests to verify they fail**

Run: `npx tsx --test spec/unit/linux-command-backends.test.ts spec/unit/backend-registry.test.ts`

Expected: FAIL because the Linux backend module does not exist yet.

- [ ] **Step 3: Implement the X11 backend**

Use:

```bash
xclip -selection clipboard -t text/uri-list -silent -i
```

with `payload.fileUris.join("\r\n") + "\r\n"` as stdin.

- [ ] **Step 4: Implement the Wayland backend**

Use:

```bash
wl-copy --type text/uri-list
```

with the same URI-list payload on stdin.

- [ ] **Step 5: Wire Linux platform selection into backend construction**

Selection rules:

- Linux + `wayland` -> `wl-copy` backend first, then path-text fallback
- Linux + `x11` -> `xclip` backend first, then path-text fallback
- Linux + `unknown` -> try `wl-copy`, then `xclip`, then path-text fallback

- [ ] **Step 6: Return actionable dependency messages**

Examples:

- `Install wl-clipboard to enable file copy on Wayland.`
- `Install xclip to enable file copy on X11.`

- [ ] **Step 7: Run the Linux backend tests again**

Run: `npx tsx --test spec/unit/linux-command-backends.test.ts spec/unit/backend-registry.test.ts`

Expected: PASS with Linux backend coverage green.

- [ ] **Step 8: Commit the Linux backend task**

```bash
git add src/modules/copy/clipboard/linuxCommandBackends.ts src/modules/copy/clipboard/backendRegistry.ts src/modules/copy/clipboard/platformDetection.ts spec/unit/linux-command-backends.test.ts spec/unit/backend-registry.test.ts
git commit -m "feat: add linux clipboard command backends"
```

### Task 11: Implement the macOS `osascript` Backend

**Files:**

- Create: `src/modules/copy/clipboard/macosCommandBackend.ts`
- Modify: `src/modules/copy/clipboard/backendRegistry.ts`
- Test: `spec/unit/macos-command-backend.test.ts`
- Modify: `spec/unit/backend-registry.test.ts`

- [ ] **Step 1: Write the failing macOS backend tests**

Cover:

- the generated AppleScript for one file
- the generated AppleScript for multiple files
- dependency handling if `osascript` is unavailable or exits non-zero

Example:

```ts
test("buildMacClipboardScript creates a Finder clipboard list", () => {
  assert.equal(
    buildMacClipboardScript(["/Users/me/A.pdf", "/Users/me/B.epub"]),
    'tell application "Finder" to set the clipboard to {POSIX file "/Users/me/A.pdf", POSIX file "/Users/me/B.epub"}',
  );
});
```

- [ ] **Step 2: Run the macOS backend tests to verify they fail**

Run: `npx tsx --test spec/unit/macos-command-backend.test.ts spec/unit/backend-registry.test.ts`

Expected: FAIL because the macOS backend module does not exist yet.

- [ ] **Step 3: Implement the AppleScript builder and backend**

Invoke:

```bash
/usr/bin/osascript -e 'tell application "Finder" to set the clipboard to {POSIX file "/Users/me/A.pdf"}'
```

Return `copied-files` on success.

- [ ] **Step 4: Register the macOS backend ahead of path-text fallback**

Use the backend order:

- macOS command backend
- path-text fallback

- [ ] **Step 5: Run the macOS backend tests again**

Run: `npx tsx --test spec/unit/macos-command-backend.test.ts spec/unit/backend-registry.test.ts`

Expected: PASS with all macOS backend tests green.

- [ ] **Step 6: Commit the macOS backend task**

```bash
git add src/modules/copy/clipboard/macosCommandBackend.ts src/modules/copy/clipboard/backendRegistry.ts spec/unit/macos-command-backend.test.ts spec/unit/backend-registry.test.ts
git commit -m "feat: add macos clipboard command backend"
```

### Task 12: Add Diagnostics and Wire Them Into Notifications and Preferences

**Files:**

- Create: `src/modules/copy/clipboard/diagnostics.ts`
- Modify: `src/modules/copy/notifier.ts`
- Modify: `src/modules/preferenceScript.ts`
- Modify: `src/utils/prefs.ts`
- Modify: `addon/content/preferences.xhtml`
- Modify: `addon/locale/en-US/preferences.ftl`
- Modify: `addon/locale/zh-CN/preferences.ftl`
- Modify: `spec/unit/preference-script.test.ts`

- [ ] **Step 1: Write the failing diagnostics tests**

Add a pure test for:

```ts
test("buildClipboardDiagnostics summarizes detected commands and backend", () => {
  const diagnostics = buildClipboardDiagnostics({
    platform: "linux",
    linuxSession: "wayland",
    commands: { "wl-copy": true, xclip: false },
    activeBackend: "linux-wayland-wl-copy",
  });

  assert.equal(diagnostics.lines[0], "Platform: linux (wayland)");
  assert.match(diagnostics.lines[1], /wl-copy: available/);
});
```

- [ ] **Step 2: Run the preference and diagnostics tests to verify they fail**

Run: `npx tsx --test spec/unit/preference-script.test.ts`

Expected: FAIL because diagnostics rendering helpers are missing.

- [ ] **Step 3: Implement the diagnostics builder**

Return a normalized object containing:

- detected platform
- Linux session
- command availability
- active backend
- last fallback reason

- [ ] **Step 4: Surface diagnostics in the preferences UI**

Render static text lines or a compact list. Do not add a complex live console.
The goal is user-facing explainability, not debug noise.

- [ ] **Step 5: Update notification messages to use structured outcomes**

Make sure `dependency-missing` and `backend-unavailable` use the same phrasing
as the diagnostics section.

- [ ] **Step 6: Run the preference/diagnostics tests again**

Run: `npx tsx --test spec/unit/preference-script.test.ts`

Expected: PASS with diagnostics-related assertions green.

- [ ] **Step 7: Commit the diagnostics task**

```bash
git add src/modules/copy/clipboard/diagnostics.ts src/modules/copy/notifier.ts src/modules/preferenceScript.ts src/utils/prefs.ts addon/content/preferences.xhtml addon/locale/en-US/preferences.ftl addon/locale/zh-CN/preferences.ftl spec/unit/preference-script.test.ts
git commit -m "feat: add clipboard backend diagnostics"
```

## Chunk 4: Documentation and Verification

### Task 13: Update README and Manual Testing Matrix

**Files:**

- Modify: `README.md`
- Modify: `docs/manual-testing.md`

- [ ] **Step 1: Write the doc assertions as a checklist before editing**

Document these behavior changes:

- reader copy uses a toolbar button by default
- library shortcut is configurable
- reader shortcut is opt-in
- Linux dependencies differ for X11 and Wayland
- macOS uses `osascript`

- [ ] **Step 2: Update `README.md`**

Add:

- supported platforms and current backend type
- dependency notes for `wl-copy` and `xclip`
- reader toolbar usage
- fallback behavior

- [ ] **Step 3: Expand `docs/manual-testing.md` into a matrix**

Include sections for:

- Windows Explorer / WeChat / QQ / browser target
- Linux X11 file manager / Chrome / Firefox / Telegram
- Linux Wayland file manager / Chrome / Firefox / Telegram
- macOS Finder / browser / chat target

- [ ] **Step 4: Commit the docs task**

```bash
git add README.md docs/manual-testing.md
git commit -m "docs: update clipboard platform usage guide"
```

### Task 14: Run Full Verification

**Files:**

- Modify if needed: any files touched by fixes discovered during verification

- [ ] **Step 1: Run unit tests**

Run: `npm run test:unit`

Expected: PASS with all `spec/unit` tests green.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: PASS with `zotero-plugin build` succeeding and `tsc --noEmit`
returning no errors.

- [ ] **Step 3: Run lint checks**

Run: `npm run lint:check`

Expected: PASS with Prettier and ESLint reporting no issues.

- [ ] **Step 4: Run Zotero integration tests if the local binary is configured**

Run in PowerShell:

```powershell
$env:ZOTERO_PLUGIN_ZOTERO_BIN_PATH='C:\Program Files\Zotero\zotero.exe'
npm run test
```

Expected: PASS if the environment is available; otherwise record that this step
was not run.

- [ ] **Step 5: Perform manual smoke tests from `docs/manual-testing.md`**

At minimum verify:

- Windows copy still pastes files into Explorer
- Linux X11 and Wayland use the right backend message
- macOS Finder accepts pasted files
- reader toolbar button works and default `Ctrl+C` remains native in reader

- [ ] **Step 6: Fix any issues and re-run the affected verification commands**

Do not mark the plan complete until the failing command has been rerun and
passes.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: ship cross-platform clipboard backends"
```

- [ ] **Step 8: Capture completion evidence**

Record:

- `git log --oneline -5`
- the final `npm run test:unit`
- the final `npm run build`
- the final `npm run lint:check`
- whether `npm run test` was executed

Use this as the handoff summary and final verification proof.
