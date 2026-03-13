# X11 Clipboard Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the Linux X11 clipboard implementation after the debugging cycle, keep the working GTK helper path, remove dead debugging-era structure, and finish with a narrow commit.

**Architecture:** Keep `linuxX11GtkBackend.ts` as the single owner of the X11 file-manager clipboard protocol, keep `commandRunner.ts` as the subprocess boundary, and keep `clipboardWriter.ts` as a small backend selector. Remove any leftover code paths, test helpers, or docs that still describe the old Gecko-native attempt or the earlier `xclip`-only assumption.

**Tech Stack:** TypeScript ESM, Zotero XPCOM APIs, Gecko `Subprocess`, Python 3 + GTK via `python3-gi`, Node `tsx` tests, Prettier, ESLint.

---

## Chunk 1: X11 Backend Boundary Cleanup

### Task 1: Lock the final X11 backend contract with characterization tests

**Files:**

- Modify: `spec/unit/clipboard-writer.test.ts`
- Modify: `spec/unit/command-runner.test.ts`
- Modify: `spec/unit/linux-x11-gtk-backend.test.ts`

- [ ] **Step 1: Add or tighten characterization tests for the final backend roles**

Lock these behaviors:

- `writeClipboard()` picks `linux-x11-gtk-file-copy` before `xclip`.
- `CommandRunner.startCommand()` is only responsible for “started vs exited early”.
- `buildLinuxX11GtkHelperInput()` emits `text/uri-list` with CRLF and `x-special/gnome-copied-files` without a trailing newline.

- [ ] **Step 2: Run focused tests to confirm the characterization is correct**

Run:

```bash
npx tsx --test spec/unit/clipboard-writer.test.ts spec/unit/command-runner.test.ts spec/unit/linux-x11-gtk-backend.test.ts
```

Expected:

- All tests pass before cleanup starts.
- If a test fails, fix the test expectation before touching production code.

- [ ] **Step 3: Commit the characterization-only test changes if needed**

```bash
git add spec/unit/clipboard-writer.test.ts spec/unit/command-runner.test.ts spec/unit/linux-x11-gtk-backend.test.ts
git commit -m "test: lock X11 clipboard cleanup contract"
```

### Task 2: Shrink the production surface to the current design

**Files:**

- Modify: `src/modules/copy/clipboardWriter.ts`
- Modify: `src/modules/copy/clipboard/commandRunner.ts`
- Modify: `src/modules/copy/clipboard/linuxX11GtkBackend.ts`
- Modify: `src/modules/copy/clipboard/linuxCommandBackends.ts`

- [ ] **Step 1: Remove dead or misleading abstractions from the writer layer**

Keep only the dependency hooks that still matter:

- `probeCommand`
- `runCommand`
- `startCommand`
- `writeWindowsFileDrop`
- `writePathText`

Do not reintroduce:

- Gecko-native Linux file-copy helpers
- Linux file-object fallback branches
- clipboard string helper code for arbitrary X11 flavors

- [ ] **Step 2: Make the subprocess boundary read cleanly**

Refactor `src/modules/copy/clipboard/commandRunner.ts` so the intent is obvious:

- one path for “run and wait”
- one path for “start background helper”
- shared command resolution
- shared stdin writing

The file should not look like a debugging scratchpad after cleanup.

- [ ] **Step 3: Keep the GTK helper backend focused on protocol ownership**

In `src/modules/copy/clipboard/linuxX11GtkBackend.ts`:

- keep probe script creation
- keep helper input creation
- keep helper launcher creation
- keep the GNOME payload builder local to this module

Do not spread protocol details back into `clipboardWriter.ts`.

- [ ] **Step 4: Run focused tests after the refactor**

Run:

```bash
npx tsx --test spec/unit/clipboard-writer.test.ts spec/unit/command-runner.test.ts spec/unit/linux-x11-gtk-backend.test.ts spec/unit/linux-command-backends.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit the production cleanup**

```bash
git add src/modules/copy/clipboardWriter.ts src/modules/copy/clipboard/commandRunner.ts src/modules/copy/clipboard/linuxX11GtkBackend.ts src/modules/copy/clipboard/linuxCommandBackends.ts spec/unit/clipboard-writer.test.ts spec/unit/command-runner.test.ts spec/unit/linux-x11-gtk-backend.test.ts spec/unit/linux-command-backends.test.ts
git commit -m "refactor: simplify Linux X11 clipboard backends"
```

## Chunk 2: Diagnostics, Messages, and Manual Test Docs

### Task 3: Align diagnostics with the real X11 dependency story

**Files:**

- Modify: `src/utils/prefs.ts`
- Modify: `src/modules/copy/clipboard/diagnostics.ts`
- Modify: `src/modules/copy/uiStrings.ts`
- Modify: `spec/unit/preference-script.test.ts`

- [ ] **Step 1: Add or tighten diagnostics tests**

Cover:

- X11 primary dependency is `python3-gi`
- `xclip` is still reported only as the fallback tool when probed
- active backend names match the actual runtime path

- [ ] **Step 2: Simplify diagnostics output rules**

Ensure the diagnostics logic answers these questions cleanly:

- What platform/session is active?
- What commands/runtime pieces are available?
- Which backend would run now?
- What should the user install first if something is missing?

Avoid duplicate or contradictory Linux X11 hints.

- [ ] **Step 3: Run the targeted diagnostics tests**

Run:

```bash
npx tsx --test spec/unit/preference-script.test.ts
```

Expected:

- PASS

- [ ] **Step 4: Commit diagnostics cleanup**

```bash
git add src/utils/prefs.ts src/modules/copy/clipboard/diagnostics.ts src/modules/copy/uiStrings.ts spec/unit/preference-script.test.ts
git commit -m "refactor: align X11 clipboard diagnostics"
```

### Task 4: Update user-facing and maintainer-facing wording

**Files:**

- Modify: `src/modules/copy/notifier.ts`
- Modify: `spec/unit/notifier.test.ts`
- Modify: `docs/manual-testing.md`

- [ ] **Step 1: Keep notification wording aligned with current outcomes**

Make sure:

- native X11 GTK helper success does not read like a Gecko file-object copy
- URI fallback wording stays distinct from real file-copy success
- failure text still localizes correctly

- [ ] **Step 2: Update the manual test checklist**

In `docs/manual-testing.md`:

- Linux X11 environment should mention `python3-gi` as required for file-manager paste coverage
- `xclip` should be described as the inspection/fallback tool, not the primary file-manager path
- add the two clipboard inspection commands used during this debugging cycle

- [ ] **Step 3: Run targeted tests**

Run:

```bash
npx tsx --test spec/unit/notifier.test.ts spec/unit/preference-script.test.ts
```

Expected:

- PASS

- [ ] **Step 4: Commit wording and docs cleanup**

```bash
git add src/modules/copy/notifier.ts spec/unit/notifier.test.ts docs/manual-testing.md
git commit -m "docs: refresh X11 clipboard verification notes"
```

## Chunk 3: Repository Hygiene, Verification, and Final Commit

### Task 5: Remove obsolete artifacts and verify there are no stale references

**Files:**

- Modify: `src/modules/copy/clipboardWriter.ts`
- Modify: `src/utils/prefs.ts`
- Modify: `spec/unit/clipboard-writer.test.ts`
- Modify: `spec/unit/command-runner.test.ts`
- Modify: `spec/unit/notifier.test.ts`
- Modify: `spec/unit/preference-script.test.ts`
- Verify: `src/modules/copy/clipboard/linuxX11GtkBackend.ts`
- Verify: `spec/unit/linux-x11-gtk-backend.test.ts`

- [ ] **Step 1: Search for stale names and delete leftovers**

Run:

```bash
rg -n "linuxNativeBackend|buildByteClipboardTransferSpec|writeLinuxFileCopy|writeFileObject\\(|linux-x11-native-file-copy" src spec addon
```

Expected:

- No stale references remain.

- [ ] **Step 2: Remove redundant test setup and duplicated expectations**

Examples to clean:

- injection hooks that no longer exist
- assertions tied to deleted Linux native branches
- duplicated expectations now covered by the dedicated GTK backend test file

- [ ] **Step 3: Run the full fast verification suite**

Run:

```bash
npm run test:unit
npm run build -- --pretty false
npm run lint:check
```

Expected:

- all three commands pass

- [ ] **Step 4: Perform one manual X11 sanity check**

After reloading the add-on in Zotero:

```bash
xclip -selection clipboard -t text/uri-list -o | xxd -g 1
xclip -selection clipboard -t x-special/gnome-copied-files -o | xxd -g 1
```

Expected:

- `text/uri-list` starts with `file:///`
- `x-special/gnome-copied-files` starts with `copy\nfile:///`
- no extra trailing empty entry is visible in the GNOME payload

- [ ] **Step 5: Create the final commit**

```bash
git add src/modules/copy/clipboard/commandRunner.ts src/modules/copy/clipboard/linuxX11GtkBackend.ts src/modules/copy/clipboardWriter.ts src/modules/copy/clipboard/diagnostics.ts src/modules/copy/notifier.ts src/modules/copy/uiStrings.ts src/utils/prefs.ts docs/manual-testing.md spec/unit/clipboard-writer.test.ts spec/unit/command-runner.test.ts spec/unit/linux-x11-gtk-backend.test.ts spec/unit/notifier.test.ts spec/unit/preference-script.test.ts
git commit -m "fix: stabilize X11 file clipboard handling"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-13-x11-clipboard-cleanup.md`. Ready to execute?
