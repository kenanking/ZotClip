# Linux GTK4 Clipboard Migration Design

## Summary

ZotClip should migrate Linux clipboard handling to a single GTK4 helper path
that can run under both X11 and Wayland. The current Linux design is split
between an X11-only GTK3 helper and command-based backends (`wl-copy`, `xclip`)
that only expose `text/uri-list`. That split keeps Linux behavior working, but
it also locks the project into two different capability models and two
different dependency stories.

The long-term target is one Linux payload model and one GTK4 transport backend.
That backend should always attempt to publish the file-oriented clipboard data
that ZotClip already needs for X11 file managers and that future Wayland
targets may also require. Command-based backends should remain only as
transitional fallbacks during migration. If the GTK4 migration succeeds on the
full Linux test matrix, those fallbacks should be deleted rather than kept
indefinitely.

## Goals

- Unify Linux clipboard behavior behind one primary backend.
- Replace the current X11-specific GTK3 helper with a GTK4 helper.
- Stop treating Wayland and X11 as different payload models.
- Support multiple clipboard MIME types from one helper-owned clipboard
  session.
- Keep path-text copy as the final fallback when file-oriented copy fails.
- Make fallback removal an explicit deliverable once GTK4 validation passes.

## Non-Goals

- Preserving the current `wl-copy` and `xclip` backends long term.
- Supporting GTK3 in the new Linux primary path.
- Bundling a native compiled helper in the first migration.
- Solving every file-manager-specific clipboard quirk before the GTK4 path is
  proven.

## Current State

The Linux clipboard path is already partially refactored, but it is still split
by session type and backend style.

- [src/modules/copy/clipboardWriter.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboardWriter.ts)
  selects Linux backends by session:
  - Wayland: `wl-copy`
  - X11: GTK3 helper first, then `xclip`
  - Final fallback: path text
- [src/modules/copy/clipboard/linuxX11GtkBackend.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/linuxX11GtkBackend.ts)
  implements an X11-only clipboard owner through `python3`, PyGObject GTK3, and
  `ctypes`.
- [src/modules/copy/clipboard/linuxCommandBackends.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/linuxCommandBackends.ts)
  implements `wl-copy` and `xclip` command transports that only write
  `text/uri-list`.
- [src/modules/copy/clipboard/payload.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/payload.ts)
  already builds a platform-neutral payload (`paths`, `fileUris`, `pathText`),
  but Linux-specific MIME composition still lives inside backends.
- [src/utils/prefs.ts](/home/cvrsg/Projects/ZotClip/src/utils/prefs.ts) and
  [src/modules/copy/clipboard/diagnostics.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/diagnostics.ts)
  expose Linux diagnostics using the current split dependency model.

This is workable, but it leaves Linux with two different primary transport
stories:

- X11 depends on a long-running helper that can serve multiple clipboard
  targets.
- Wayland depends on a command tool that serves a single MIME type.

That is the main design problem this migration should remove.

## Technical Constraints

The migration should treat the following constraints as hard requirements, not
optimistic assumptions.

### GTK4 Is the Correct Linux Abstraction

GTK4 and GDK4 provide a clipboard API that is already designed to work across
display backends.

- `GdkClipboard.set_content()` is the modern clipboard write entry point.
- `GdkContentProvider.new_union()` allows one clipboard owner to expose more
  than one content format.
- `GdkContentProvider.new_for_bytes()` is sufficient for file-oriented payloads
  that are already represented as byte strings.

This is a better fit than the current GTK3 callback path because the new API is
meant to model multiple formats directly instead of forcing low-level callback
plumbing.

### Wayland Ownership Is Stricter Than X11

The migration must not assume that a helper can write to the Wayland clipboard
and exit immediately. A live provider process is part of the design.

The helper must remain alive long enough to serve clipboard requests and must
only be considered production-ready on Wayland after explicit validation. A
successful X11 design does not prove a successful Wayland design.

### `wl-copy` and `xclip` Are Useful Tools, Not the Long-Term Model

The existing command backends are still useful during migration, but they
should be treated as transitional compatibility paths:

- `xclip` is weaker than the current X11 helper because it only publishes
  `text/uri-list`.
- `wl-copy` works for the current tested Wayland targets because those targets
  accept `text/uri-list`, but it still enforces a different capability ceiling
  than a multi-format provider.

The project should stop designing Linux behavior around the limitations of
those CLIs.

## Target Architecture

### 1. Keep One Cross-Platform Base Payload

The existing payload builder in
[src/modules/copy/clipboard/payload.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/payload.ts)
should remain the canonical source for:

- `paths`
- `fileUris`
- `pathText`
- `operation`
- `source`

Do not duplicate Zotero attachment resolution logic inside the Linux helper.

### 2. Add a Linux MIME Payload Adapter

Add a focused Linux payload adapter that converts the base payload into the
exact byte strings the Linux helper must publish.

Recommended new file:

- `src/modules/copy/clipboard/linuxPayload.ts`

Responsibilities:

- Build `text/uri-list` bytes using `\r\n` separators and a trailing `\r\n`.
- Build `x-special/gnome-copied-files` bytes using `copy\n` followed by the URI
  list without an extra trailing blank entry.
- Keep MIME assembly separate from process spawning and backend selection.

The Linux helper should consume already-normalized byte payloads instead of
re-deriving file URI behavior on the Python side.

### 3. Replace the X11-Specific Helper With a Unified GTK4 Helper

Introduce a new Linux helper backend that works for both X11 and Wayland.

Recommended new files:

- `src/modules/copy/clipboard/linuxGtkBackend.ts`
- `addon/content/helpers/linux_clipboard_helper.py`

TypeScript responsibilities:

- Probe whether `python3` can import `gi` and `Gtk 4.0`.
- Build Linux MIME payloads.
- Spawn the helper with JSON input.
- Track helper startup failure separately from successful clipboard ownership.

Python helper responsibilities:

- Import `gi`, `Gtk`, `Gdk`, and `GLib` for GTK4.
- Resolve the default `GdkDisplay` and clipboard at runtime.
- Build one provider for `text/uri-list`.
- Build one provider for `x-special/gnome-copied-files`.
- Combine those providers with `Gdk.ContentProvider.new_union()`.
- Call `clipboard.set_content(provider)`.
- Enter a short-lived `GLib.MainLoop()` and remain the clipboard owner until one
  of these happens:
  - ownership is lost
  - the helper reaches a conservative timeout
  - the parent process explicitly asks it to exit

The helper should be a standalone packaged file, not an inline Python string in
TypeScript. That keeps the transport code reviewable and testable.

### 4. Collapse Linux Backend Selection to One Primary Path

After the GTK4 helper exists, Linux backend selection should move toward this
shape:

1. `linux-gtk4-helper`
2. `path-text`

During migration only, the command fallbacks may remain between those two:

1. `linux-gtk4-helper`
2. `linux-wayland-wl-copy-uri-list`
3. `linux-x11-xclip-uri-list`
4. `path-text`

That ordering should be temporary. It is not the target architecture.

### 5. Make Diagnostics Capability-Based

The Linux diagnostics UI should stop presenting package names as if they were
commands. The new primary check is not "is `wl-copy` installed" or "is
`xclip` installed"; it is "can ZotClip launch the GTK4 clipboard helper in the
current Linux session".

Update these files:

- [src/utils/prefs.ts](/home/cvrsg/Projects/ZotClip/src/utils/prefs.ts)
- [src/modules/copy/clipboard/diagnostics.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/diagnostics.ts)

Recommended Linux diagnostics model:

- Session: `x11`, `wayland`, or `unknown`
- `gtk4-helper`: available or missing
- Active backend: `linux-gtk4-helper`, `wl-copy`, `xclip`, or `path-text`
- Fallback note only when the active backend is not the GTK4 helper

During migration, `wl-copy` and `xclip` can still appear in diagnostics when
they are genuinely active fallbacks. After cleanup, they should disappear from
normal dependency messaging.

## Migration Phases

### Phase 1: Prepare Shared Linux MIME Building

Code changes:

- Keep [src/modules/copy/clipboard/payload.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/payload.ts)
  as the base payload builder.
- Add `src/modules/copy/clipboard/linuxPayload.ts`.
- Update or add unit tests for URI list and GNOME copied-files payload output.

Goal:

- One place defines the Linux clipboard bytes regardless of session type.

### Phase 2: Land a GTK4 Helper Prototype

Code changes:

- Add `addon/content/helpers/linux_clipboard_helper.py`.
- Add `src/modules/copy/clipboard/linuxGtkBackend.ts`.
- Extend [src/modules/copy/clipboard/commandRunner.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/commandRunner.ts)
  only as much as needed to start and monitor the helper.

Goal:

- A local prototype can claim the clipboard, expose both MIME types, and remain
  alive long enough for manual paste testing.

Exit criteria:

- X11 prototype verified in Nautilus.
- Wayland prototype verified as a live clipboard owner, not just as a launched
  process.

### Phase 3: Promote GTK4 Helper to the Linux Primary Path

Code changes:

- Replace Linux backend ordering in
  [src/modules/copy/clipboardWriter.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboardWriter.ts).
- Update diagnostics and dependency messaging in
  [src/utils/prefs.ts](/home/cvrsg/Projects/ZotClip/src/utils/prefs.ts) and
  [src/modules/copy/clipboard/diagnostics.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/diagnostics.ts).
- Update [docs/manual-testing.md](/home/cvrsg/Projects/ZotClip/docs/manual-testing.md)
  to treat GTK4 helper validation as the Linux mainline path.

Goal:

- Linux uses the GTK4 helper first under both X11 and Wayland.

### Phase 4: Remove Transitional Fallbacks After Validation

This phase is mandatory if the GTK4 path passes the defined test matrix.

Delete or simplify the following:

- [src/modules/copy/clipboard/linuxX11GtkBackend.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/linuxX11GtkBackend.ts)
- [src/modules/copy/clipboard/linuxCommandBackends.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/linuxCommandBackends.ts)
- X11- and Wayland-specific Linux fallback selection branches in
  [src/modules/copy/clipboardWriter.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboardWriter.ts)
- Linux command dependency probes in
  [src/utils/prefs.ts](/home/cvrsg/Projects/ZotClip/src/utils/prefs.ts)
- Linux command dependency wording in
  [src/modules/copy/clipboard/diagnostics.ts](/home/cvrsg/Projects/ZotClip/src/modules/copy/clipboard/diagnostics.ts)
- Fallback-only tests that are no longer relevant after removal

Keep:

- path-text fallback
- optional clipboard inspection guidance in
  [docs/manual-testing.md](/home/cvrsg/Projects/ZotClip/docs/manual-testing.md)
  if `xclip` remains useful as a manual debugging tool

This cleanup should happen in the same migration stream, not as an indefinite
"later".

## Testing Plan

### Automated Tests

Add or update unit coverage for:

- Linux MIME payload assembly
  - single file
  - multiple files
  - spaces
  - non-ASCII paths
  - `#` and `?` characters
  - no extra trailing blank entry in `x-special/gnome-copied-files`
- GTK4 helper probe command construction
- GTK4 helper process launch success and startup failure handling
- Linux backend selection order
- Diagnostics for:
  - GTK4 helper available
  - GTK4 helper missing
  - fallback active

If the helper can be exercised in automated tests without a real desktop
session, add a focused helper contract test that validates the JSON input shape
and the MIME provider assembly code path.

### Manual Verification Matrix

The migration is not complete until it passes this matrix:

- GNOME X11
  - Nautilus single-file paste
  - Nautilus multi-file paste
  - Chromium file paste or upload target
  - Firefox file paste or upload target
  - one Electron-based chat target
- GNOME Wayland
  - Nautilus single-file paste
  - Nautilus multi-file paste
  - Chromium file paste or upload target
  - Firefox file paste or upload target
  - one Electron-based chat target
- One non-GNOME Linux target
  - KDE Wayland with Dolphin, or
  - Xfce/Thunar, or
  - Cinnamon/Nemo

### Success Gates for Fallback Removal

Do not delete `wl-copy` and `xclip` until all of the following are true:

- GTK4 helper is the active backend on GNOME X11.
- GTK4 helper is the active backend on GNOME Wayland.
- Single-file and multi-file paste succeed in the target file manager on both
  GNOME X11 and GNOME Wayland.
- Browser upload or file-paste targets still accept the copied files on both
  GNOME X11 and GNOME Wayland.
- The helper remains alive long enough to complete paste in Wayland without
  focus-related loss.
- Diagnostics and notifications no longer depend on `wl-copy` or `xclip` for
  the success path.

If any of these fail, keep the GTK4 migration work, but do not delete the
command fallbacks yet.

## Risks

- Wayland clipboard ownership may still behave differently enough that the
  helper requires additional lifecycle control.
- Some file managers may ignore `x-special/gnome-copied-files` even when
  Nautilus accepts it.
- Ubuntu package availability for GTK4 introspection must be validated on the
  supported distro set before finalizing dependency text.
- A helper that works in a local session does not automatically prove stable
  behavior when launched from Zotero under every desktop shell.

These are migration risks, not reasons to keep the split architecture forever.
They should drive the prototype and test matrix.

## Dependency Direction

The target Linux dependency story should move toward:

- `python3`
- `python3-gi`
- GTK4 introspection package, such as `gir1.2-gtk-4.0`

The diagnostics and installation guidance should describe the GTK4 helper
capability directly. They should not continue to frame `wl-copy` and `xclip` as
the normal Linux requirements after the migration is complete.

## Cleanup Memo

If the GTK4 migration succeeds, remove the redundant Linux command fallbacks.
Do not keep `wl-copy` and `xclip` as legacy code "just in case". The project
already states that backward compatibility should not block refactoring, and
these fallbacks encode the old split design.

Successful migration means:

- the GTK4 helper is the Linux primary path on both X11 and Wayland
- the validation matrix passes
- diagnostics no longer rely on command-specific dependency messaging

At that point, the correct cleanup action is deletion, not coexistence.

## References

- GTK4 `GdkClipboard.set_content()`:
  https://docs.gtk.org/gdk4/method.Clipboard.set_content.html
- GTK4 `GdkContentProvider.new_union()`:
  https://docs.gtk.org/gdk4/ctor.ContentProvider.new_union.html
- GTK4 `GdkContentProvider.new_for_bytes()`:
  https://docs.gtk.org/gdk4/ctor.ContentProvider.new_for_bytes.html
- PyGObject GTK4 clipboard tutorial:
  https://pygobject.gnome.org/tutorials/gtk4/clipboard.html
- Wayland protocol overview:
  https://wayland.freedesktop.org/docs/html/ch04.html
- Wayland `wl_data_device.set_selection` reference:
  https://wayland.freedesktop.org/docs/html/apa.html
- `wl-clipboard` behavior and limitations:
  https://man.archlinux.org/man/wl-clipboard.1
