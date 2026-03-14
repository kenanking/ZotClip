# Linux GTK4 Clipboard Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ZotClip's split Linux clipboard transport with one GTK4 helper backend for X11 and Wayland, then delete redundant Linux command fallbacks after the GTK4 path passes the validation matrix.

**Architecture:** Keep `buildClipboardPayload()` as the only Zotero-facing payload builder, add a Linux MIME adapter that produces `text/uri-list` and `x-special/gnome-copied-files`, and move Linux clipboard ownership into a packaged Python GTK4 helper. Promote the GTK4 helper to the Linux primary path first, keep `wl-copy` and `xclip` only as temporary migration fallbacks, and remove those fallbacks once automated and manual validation pass.

**Tech Stack:** TypeScript ESM, Zotero plugin scaffold, Python 3, PyGObject GTK4, GLib main loop, `Subprocess.sys.mjs`, `node:test` via `tsx`

---

## Scope Notes

- This plan covers one subsystem: Linux clipboard transport.
- Follow `@superpowers/test-driven-development` for each task.
- Before claiming the migration is complete, follow
  `@superpowers/verification-before-completion`.
- Reuse the existing global `rootURI` declared in
  [typings/global.d.ts](/home/cvrsg/Projects/ZotClip/typings/global.d.ts) to
  resolve the packaged helper file path.
- Do not preserve the current Linux fallback structure after the GTK4 path is
  proven. The cleanup phase is part of the migration, not optional future work.

## File Map

### New files to create

- `src/modules/copy/clipboard/linuxPayload.ts`
  - Build Linux-specific MIME payload strings and helper JSON input from
    `ClipboardPayload.fileUris`.
- `src/modules/copy/clipboard/linuxGtkBackend.ts`
  - Probe GTK4 support, resolve the packaged helper path, and start the GTK4
    helper process.
- `addon/content/helpers/linux_clipboard_helper.py`
  - Own the clipboard through GTK4 and publish multiple MIME types.
- `spec/unit/linux-payload.test.ts`
  - Unit tests for Linux MIME payload generation.
- `spec/unit/linux-gtk-backend.test.ts`
  - Unit tests for GTK4 probe calls, helper path resolution, and backend write
    behavior.

### Existing files to modify

- `src/modules/copy/clipboardWriter.ts`
  - Switch Linux backend ordering from split session-specific backends to the
    GTK4 helper primary path.
- `src/utils/prefs.ts`
  - Probe GTK4 helper availability and report the active Linux backend.
- `src/modules/copy/clipboard/diagnostics.ts`
  - Make diagnostics capability-based and update Linux install guidance.
- `docs/manual-testing.md`
  - Replace Linux command-centric testing notes with GTK4 helper validation and
    fallback gates.
- `spec/unit/clipboard-writer.test.ts`
  - Cover GTK4 helper priority, fallback ordering, and final cleanup state.
- `spec/unit/preference-script.test.ts`
  - Cover GTK4 helper diagnostics and install guidance.

### Existing files to delete after validation passes

- `src/modules/copy/clipboard/linuxX11GtkBackend.ts`
- `src/modules/copy/clipboard/linuxCommandBackends.ts`
- `spec/unit/linux-x11-gtk-backend.test.ts`
- `spec/unit/linux-command-backends.test.ts`

## Chunk 1: GTK4 Foundation

### Task 1: Extract Linux MIME Payload Building

**Files:**

- Create: `src/modules/copy/clipboard/linuxPayload.ts`
- Test: `spec/unit/linux-payload.test.ts`
- Modify: `src/modules/copy/clipboard/linuxX11GtkBackend.ts`
- Modify: `spec/unit/linux-x11-gtk-backend.test.ts`

- [ ] **Step 1: Write the failing Linux payload tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLinuxClipboardPayload,
  buildLinuxClipboardPayloadInput,
} from "../../src/modules/copy/clipboard/linuxPayload";

test("buildLinuxClipboardPayload creates both Linux MIME payloads", () => {
  const payload = buildLinuxClipboardPayload([
    "file:///home/user/A.pdf",
    "file:///home/user/B%20File.epub",
  ]);

  assert.equal(
    payload.uriListText,
    "file:///home/user/A.pdf\r\nfile:///home/user/B%20File.epub\r\n",
  );
  assert.equal(
    payload.gnomeCopiedFilesText,
    "copy\nfile:///home/user/A.pdf\nfile:///home/user/B%20File.epub",
  );
});

test("buildLinuxClipboardPayloadInput serializes helper JSON input", () => {
  assert.deepEqual(
    JSON.parse(buildLinuxClipboardPayloadInput(["file:///home/user/A.pdf"])),
    {
      uri_payload: "file:///home/user/A.pdf\r\n",
      gnome_payload: "copy\nfile:///home/user/A.pdf",
    },
  );
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx tsx --test spec/unit/linux-payload.test.ts spec/unit/linux-x11-gtk-backend.test.ts`

Expected: FAIL with a module-not-found or missing-export error for
`linuxPayload`.

- [ ] **Step 3: Implement the Linux payload adapter and route the existing X11 helper through it**

```ts
// src/modules/copy/clipboard/linuxPayload.ts
export interface LinuxClipboardPayloadData {
  uriListText: string;
  gnomeCopiedFilesText: string;
}

export function buildLinuxClipboardPayload(
  fileUris: string[],
): LinuxClipboardPayloadData {
  return {
    uriListText: `${fileUris.join("\r\n")}\r\n`,
    gnomeCopiedFilesText: `copy\n${fileUris.join("\n")}`,
  };
}

export function buildLinuxClipboardPayloadInput(fileUris: string[]): string {
  const payload = buildLinuxClipboardPayload(fileUris);
  return JSON.stringify({
    uri_payload: payload.uriListText,
    gnome_payload: payload.gnomeCopiedFilesText,
  });
}
```

Update `src/modules/copy/clipboard/linuxX11GtkBackend.ts` so its helper input
builder calls `buildLinuxClipboardPayloadInput()` instead of assembling MIME
strings inline.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `npx tsx --test spec/unit/linux-payload.test.ts spec/unit/linux-x11-gtk-backend.test.ts`

Expected: PASS for the new Linux payload tests and the existing X11 helper
tests.

- [ ] **Step 5: Commit the payload extraction**

```bash
git add src/modules/copy/clipboard/linuxPayload.ts \
  src/modules/copy/clipboard/linuxX11GtkBackend.ts \
  spec/unit/linux-payload.test.ts \
  spec/unit/linux-x11-gtk-backend.test.ts
git commit -m "refactor: extract Linux clipboard payload builder"
```

### Task 2: Add a Standalone GTK4 Helper Backend

**Files:**

- Create: `src/modules/copy/clipboard/linuxGtkBackend.ts`
- Create: `addon/content/helpers/linux_clipboard_helper.py`
- Test: `spec/unit/linux-gtk-backend.test.ts`

- [ ] **Step 1: Write the failing GTK4 helper backend tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLinuxGtkClipboardCommand,
  buildLinuxGtkProbeCall,
  createLinuxGtkBackend,
} from "../../src/modules/copy/clipboard/linuxGtkBackend";

const samplePayload = {
  paths: ["/home/user/a.pdf"],
  fileUris: ["file:///home/user/a.pdf"],
  pathText: "/home/user/a.pdf",
  operation: "copy" as const,
  source: "library" as const,
};

test("buildLinuxGtkProbeCall checks GTK4 availability", () => {
  assert.deepEqual(buildLinuxGtkProbeCall(), {
    command: "python3",
    args: [
      "-c",
      'import gi; gi.require_version("Gtk", "4.0"); from gi.repository import Gdk; raise SystemExit(0 if Gdk.Display.get_default() is not None else 1)',
    ],
  });
});

test("buildLinuxGtkClipboardCommand targets the packaged helper script", () => {
  const command = buildLinuxGtkClipboardCommand(samplePayload);

  assert.equal(command.command, "python3");
  assert.match(command.args[0], /linux_clipboard_helper\\.py$/);
  assert.match(command.stdinText || "", /"gnome_payload":/);
});

test("linux GTK backend starts the helper after a successful probe", async () => {
  const backend = createLinuxGtkBackend({
    runCommand: async () => ({ ok: true, exitCode: 0, stdout: "", stderr: "" }),
    startCommand: async () => ({
      ok: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
    }),
  });

  assert.deepEqual(await backend.isAvailable(samplePayload), {
    available: true,
  });
  assert.equal((await backend.write(samplePayload)).ok, true);
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx tsx --test spec/unit/linux-gtk-backend.test.ts`

Expected: FAIL with a module-not-found error for `linuxGtkBackend`.

- [ ] **Step 3: Implement the GTK4 helper backend and packaged Python helper**

```ts
// src/modules/copy/clipboard/linuxGtkBackend.ts
import { buildLinuxClipboardPayloadInput } from "./linuxPayload";

const GTK_HELPER_COMMAND = "python3";
const GTK_HELPER_START_OPTIONS = { startupTimeoutMs: 300 };

export function buildLinuxGtkProbeCall(): CommandCall {
  return {
    command: GTK_HELPER_COMMAND,
    args: [
      "-c",
      'import gi; gi.require_version("Gtk", "4.0"); from gi.repository import Gdk; raise SystemExit(0 if Gdk.Display.get_default() is not None else 1)',
    ],
  };
}

function resolveLinuxGtkHelperPath(): string {
  const helperUri = Services.io.newURI(
    `${rootURI}content/helpers/linux_clipboard_helper.py`,
  );
  return helperUri.QueryInterface(Ci.nsIFileURL).file.path;
}

export function buildLinuxGtkClipboardCommand(
  payload: ClipboardPayload,
): CommandCall {
  return {
    command: GTK_HELPER_COMMAND,
    args: [resolveLinuxGtkHelperPath()],
    stdinText: buildLinuxClipboardPayloadInput(payload.fileUris),
  };
}
```

```python
# addon/content/helpers/linux_clipboard_helper.py
import json
import signal
import sys

import gi

gi.require_version("Gtk", "4.0")

from gi.repository import Gdk, GLib

payload = json.load(sys.stdin)
display = Gdk.Display.get_default()
if display is None:
    raise RuntimeError("Display unavailable")

clipboard = display.get_clipboard()
uri_bytes = GLib.Bytes.new(payload["uri_payload"].encode("utf-8"))
gnome_bytes = GLib.Bytes.new(payload["gnome_payload"].encode("utf-8"))
provider = Gdk.ContentProvider.new_union([
    Gdk.ContentProvider.new_for_bytes("text/uri-list", uri_bytes),
    Gdk.ContentProvider.new_for_bytes(
        "x-special/gnome-copied-files",
        gnome_bytes,
    ),
])
if not clipboard.set_content(provider):
    raise RuntimeError("Failed to claim clipboard ownership")

loop = GLib.MainLoop()
GLib.timeout_add_seconds(20, lambda: (loop.quit(), False)[1])
signal.signal(signal.SIGINT, lambda *_args: loop.quit())
signal.signal(signal.SIGTERM, lambda *_args: loop.quit())
loop.run()
```

Use the current `ClipboardBackend` contract and return backend id
`linux-gtk4-helper`.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `npx tsx --test spec/unit/linux-gtk-backend.test.ts spec/unit/linux-payload.test.ts`

Expected: PASS for the GTK4 helper backend tests and the shared Linux payload
tests.

- [ ] **Step 5: Commit the GTK4 helper prototype**

```bash
git add src/modules/copy/clipboard/linuxGtkBackend.ts \
  addon/content/helpers/linux_clipboard_helper.py \
  spec/unit/linux-gtk-backend.test.ts \
  src/modules/copy/clipboard/linuxPayload.ts
git commit -m "feat: add Linux GTK4 clipboard helper backend"
```

## Chunk 2: Integration and Cleanup

### Task 3: Promote the GTK4 Helper to the Linux Primary Path

**Files:**

- Modify: `src/modules/copy/clipboardWriter.ts`
- Modify: `src/utils/prefs.ts`
- Modify: `src/modules/copy/clipboard/diagnostics.ts`
- Modify: `docs/manual-testing.md`
- Modify: `spec/unit/clipboard-writer.test.ts`
- Modify: `spec/unit/preference-script.test.ts`

- [ ] **Step 1: Write the failing integration and diagnostics tests**

```ts
test("ClipboardWriter prefers the Linux GTK4 helper before command fallbacks", async () => {
  const result = await writeClipboard(
    [{ attachmentID: 1, itemID: 1, path: "/home/user/a.pdf" }],
    "library",
    {
      detectPlatformContext: () => ({
        platform: "linux",
        linuxSession: "wayland",
      }),
      runCommand: async () => ({
        ok: true,
        exitCode: 0,
        stdout: "",
        stderr: "",
      }),
      startCommand: async () => ({
        ok: true,
        exitCode: 0,
        stdout: "",
        stderr: "",
      }),
      probeCommand: async () => false,
      writePathText: () => false,
    },
  );

  assert.equal(result.outcome, "copied-files");
});

test("buildClipboardDiagnostics reports the GTK4 helper as the active Linux backend", () => {
  const diagnostics = buildClipboardDiagnostics({
    platform: "linux",
    linuxSession: "wayland",
    commands: { "gtk4-helper": true, "wl-copy": false, xclip: false },
    activeBackend: "linux-gtk4-helper",
    languageTag: "en-US",
  });

  assert.match(diagnostics.lines.join("\n"), /gtk4-helper: available/);
  assert.match(
    diagnostics.lines.join("\n"),
    /Active backend: linux-gtk4-helper/,
  );
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx tsx --test spec/unit/clipboard-writer.test.ts spec/unit/preference-script.test.ts`

Expected: FAIL because the Linux primary backend is still split between the
GTK3 X11 helper and command backends.

- [ ] **Step 3: Switch Linux integration and diagnostics to the GTK4 helper**

```ts
// src/modules/copy/clipboardWriter.ts
const linuxBackends = [
  createLinuxGtkBackend(buildCommandDeps(deps)),
  createLinuxWaylandBackend(buildCommandDeps(deps)),
  createLinuxX11Backend(buildCommandDeps(deps)),
];
```

```ts
// src/utils/prefs.ts
if (platformContext.platform === "linux") {
  return {
    "gtk4-helper": await probeLinuxGtkSupport(),
    "wl-copy": await clipboardCommandRunner.probeCommand("wl-copy"),
    xclip: await clipboardCommandRunner.probeCommand("xclip"),
  };
}
```

```ts
// src/modules/copy/clipboard/diagnostics.ts
if (input.platform === "linux" && commands["gtk4-helper"] === false) {
  return "sudo apt install python3-gi gir1.2-gtk-4.0";
}
```

Update `docs/manual-testing.md` so Linux X11 and Wayland both validate the GTK4
helper first, and so `wl-copy` / `xclip` are described only as temporary
fallbacks.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `npx tsx --test spec/unit/linux-gtk-backend.test.ts spec/unit/clipboard-writer.test.ts spec/unit/preference-script.test.ts`

Expected: PASS with `linux-gtk4-helper` as the first successful Linux backend.

- [ ] **Step 5: Commit the Linux integration switch**

```bash
git add src/modules/copy/clipboardWriter.ts \
  src/utils/prefs.ts \
  src/modules/copy/clipboard/diagnostics.ts \
  docs/manual-testing.md \
  spec/unit/clipboard-writer.test.ts \
  spec/unit/preference-script.test.ts
git commit -m "refactor: prefer GTK4 helper for Linux clipboard"
```

### Task 4: Remove Redundant Linux Command Fallbacks After Validation

**Files:**

- Delete: `src/modules/copy/clipboard/linuxX11GtkBackend.ts`
- Delete: `src/modules/copy/clipboard/linuxCommandBackends.ts`
- Delete: `spec/unit/linux-x11-gtk-backend.test.ts`
- Delete: `spec/unit/linux-command-backends.test.ts`
- Modify: `src/modules/copy/clipboardWriter.ts`
- Modify: `src/utils/prefs.ts`
- Modify: `src/modules/copy/clipboard/diagnostics.ts`
- Modify: `docs/manual-testing.md`
- Modify: `spec/unit/clipboard-writer.test.ts`
- Modify: `spec/unit/preference-script.test.ts`

- [ ] **Step 1: Write the failing post-cleanup tests**

```ts
test("ClipboardWriter uses only the GTK4 helper and path-text on Linux", async () => {
  const result = await writeClipboard(
    [{ attachmentID: 1, itemID: 1, path: "/home/user/a.pdf" }],
    "library",
    {
      detectPlatformContext: () => ({ platform: "linux", linuxSession: "x11" }),
      runCommand: async () => ({
        ok: false,
        exitCode: 1,
        stdout: "",
        stderr: "probe failed",
      }),
      startCommand: async () => ({
        ok: false,
        exitCode: 1,
        stdout: "",
        stderr: "helper failed",
      }),
      writePathText: () => true,
    },
  );

  assert.equal(result.outcome, "copied-path-text-fallback");
});

test("buildClipboardDiagnostics no longer advertises Linux command backends", () => {
  const diagnostics = buildClipboardDiagnostics({
    platform: "linux",
    linuxSession: "x11",
    commands: { "gtk4-helper": true },
    activeBackend: "linux-gtk4-helper",
    languageTag: "en-US",
  });

  assert.equal(
    diagnostics.lines.some((line) => line.includes("wl-copy")),
    false,
  );
  assert.equal(
    diagnostics.lines.some((line) => line.includes("xclip")),
    false,
  );
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npx tsx --test spec/unit/clipboard-writer.test.ts spec/unit/preference-script.test.ts`

Expected: FAIL because Linux command backends and their diagnostics are still
present.

- [ ] **Step 3: Delete the old Linux fallbacks and simplify the remaining code**

```ts
// src/modules/copy/clipboardWriter.ts
function buildLinuxBackends(
  _platformContext: PlatformContext,
  deps: ClipboardWriterDeps,
): ClipboardBackend[] {
  return [
    createLinuxGtkBackend(buildCommandDeps(deps)),
    buildPathTextBackend(deps),
  ];
}
```

```ts
// src/utils/prefs.ts
if (platformContext.platform === "linux") {
  return {
    "gtk4-helper": await probeLinuxGtkSupport(),
  };
}
```

Delete the obsolete backend modules and their fallback-only tests. Update
`docs/manual-testing.md` so Linux verification assumes the GTK4 helper is the
only file-copy path and path text is the only remaining fallback.

- [ ] **Step 4: Run full automated verification and the Linux manual matrix**

Run: `npm run test:unit`
Expected: PASS

Run: `npm run build -- --pretty false`
Expected: PASS

Run: `npm run lint:check`
Expected: PASS

Manual verification:

- GNOME X11: Nautilus single-file and multi-file paste
- GNOME Wayland: Nautilus single-file and multi-file paste
- Chromium and Firefox file upload or paste target on both sessions
- One Electron-based chat target on both sessions
- One non-GNOME file manager target

Delete the fallback modules only after these manual checks pass.

- [ ] **Step 5: Commit the cleanup**

```bash
git add src/modules/copy/clipboardWriter.ts \
  src/utils/prefs.ts \
  src/modules/copy/clipboard/diagnostics.ts \
  docs/manual-testing.md \
  spec/unit/clipboard-writer.test.ts \
  spec/unit/preference-script.test.ts
git rm src/modules/copy/clipboard/linuxX11GtkBackend.ts \
  src/modules/copy/clipboard/linuxCommandBackends.ts \
  spec/unit/linux-x11-gtk-backend.test.ts \
  spec/unit/linux-command-backends.test.ts
git commit -m "refactor: remove Linux clipboard command fallbacks"
```
