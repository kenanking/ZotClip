# ZotClip Cross-Platform Clipboard Design

## Summary

ZotClip should evolve from a Windows-first file-copy MVP into a cross-platform
clipboard plugin for Zotero that prioritizes Linux, with explicit support for
X11 and Wayland, while preserving a stable Windows path and adding macOS
support. The plugin's core responsibility remains the same: when the user
selects Zotero items or opens an attachment in the reader, ZotClip should copy
the underlying attachment files in the strongest clipboard format the current
platform can support, with a clear fallback to path text when native file copy
is unavailable.

This design keeps attachment discovery separate from platform clipboard
transport so ZotClip can support multiple operating systems, clipboard
protocols, and delivery mechanisms without rewriting the Zotero-specific
behavior each time.

## Goals

- Preserve the existing Windows file-copy workflow while making it easier to
  extend and harden.
- Add Linux support with Linux-specific handling for X11 and Wayland.
- Add macOS support with a native-file clipboard path.
- Prefer real file clipboard data over text paths whenever the platform allows
  it.
- Make backend capability visible to the user so failures are diagnosable.
- Stop intercepting `Ctrl+C` in the reader by default.
- Add a reader toolbar button for copying the current attachment.
- Replace hard-coded shortcuts with user-configurable shortcuts.

## Non-Goals

- Shipping a bundled helper binary in the first iteration.
- Solving every app-specific clipboard quirk before the architecture is in
  place.
- Reworking ZotClip into a general export or file-management plugin.
- Adding Linux/macOS integration tests before the platform abstraction is
  established.

## Current State

The current codebase already has a workable Windows-first MVP:

- [attachmentResolver.ts](/D:/Projects/ZotClip/src/modules/copy/attachmentResolver.ts)
  resolves allowed attachments from the library and reader.
- [clipboardWriter.ts](/D:/Projects/ZotClip/src/modules/copy/clipboardWriter.ts)
  chooses a clipboard format and falls back to path text.
- [windowsFileClipboard.ts](/D:/Projects/ZotClip/src/modules/copy/windowsFileClipboard.ts)
  writes `CF_HDROP` data for native Windows file copy.
- [selectionHook.ts](/D:/Projects/ZotClip/src/modules/copy/selectionHook.ts)
  intercepts library `Ctrl+C`.
- [readerHook.ts](/D:/Projects/ZotClip/src/modules/copy/readerHook.ts)
  currently intercepts reader copy behavior.
- [preferences.xhtml](/D:/Projects/ZotClip/addon/content/preferences.xhtml)
  exposes attachment-type and reader copy settings.

This structure is a good base, but it mixes business intent and platform
transport too closely for X11, Wayland, and macOS expansion.

## Product Behavior

### Library View

- Library copy remains keyboard-first.
- ZotClip should continue to offer a library shortcut that copies selected
  attachment files or attachments resolved from selected parent items.
- The default library shortcut remains `Ctrl+C` unless the user changes it.

### Reader View

- ZotClip should no longer intercept `Ctrl+C` by default.
- The primary reader action becomes a dedicated ZotClip toolbar button in the
  reader UI.
- Clicking the toolbar button copies the currently opened attachment.
- The button should be disabled when the current reader item cannot be copied,
  such as when the attachment type is disallowed or no local file path exists.
- A user-configurable reader shortcut may be set in preferences, but it is
  empty by default.

### Fallback Rules

- ZotClip should always attempt the strongest available platform backend first.
- If file-object copy fails but a weaker interoperable representation exists,
  ZotClip should use it.
- If no file-oriented backend succeeds, ZotClip should fall back to newline-
  separated absolute path text.
- Notifications must state which result occurred: native file copy, URI/file
  list copy, or path-text fallback.

## Architecture

ZotClip should be refactored into four layers.

### 1. Attachment Selection Layer

This layer keeps Zotero-specific logic for turning user context into concrete
files.

Responsibilities:

- Resolve eligible attachments from selected library items.
- Resolve the current reader attachment.
- Filter by allowed attachment types.
- Apply multi-attachment strategy.
- De-duplicate by real file path.

This mostly preserves the role of
[attachmentResolver.ts](/D:/Projects/ZotClip/src/modules/copy/attachmentResolver.ts)
and [copyCommands.ts](/D:/Projects/ZotClip/src/modules/copy/copyCommands.ts),
with clearer separation between selection logic and clipboard transport.

### 2. Clipboard Payload Layer

Introduce a platform-neutral payload model describing what ZotClip wants to
copy, independent of how each operating system writes clipboard data.

Suggested payload fields:

- `paths: string[]`
- `fileUris: string[]`
- `pathText: string`
- `operation: "copy"`
- `source: "library" | "reader"`

This lets each backend consume the same intent while deciding which clipboard
flavors it can provide.

### 3. Clipboard Backend Layer

Introduce a backend registry that chooses the best available implementation for
the current platform/session.

Each backend should expose:

- `id`
- `platform`
- `isAvailable(): Promise<AvailabilityResult>`
- `write(payload): Promise<ClipboardResult>`
- `priority`
- `diagnostics`

Backends are responsible only for clipboard transport. They should not know how
to query Zotero items or preferences.

### 4. Copy Orchestrator Layer

Replace the current monolithic clipboard writer flow with an orchestrator that:

- builds the payload
- enumerates candidate backends
- selects the highest-priority available backend
- executes fallback order
- emits a normalized result for notifications and diagnostics

This becomes the single place that explains why a copy succeeded, degraded, or
failed.

## Platform Strategy

### Windows

Windows remains the reference implementation for native file copy.

- Keep the current `CF_HDROP` implementation in
  [windowsFileClipboard.ts](/D:/Projects/ZotClip/src/modules/copy/windowsFileClipboard.ts).
- Wrap it as a `windows-native` backend.
- Keep path-text fallback as the final fallback.
- Harden error handling and result reporting rather than changing the transport
  model.

### Linux X11

Linux X11 should start with command-driven interoperability and then gain a
higher-compatibility native/helper path later.

Phase 1 backend candidates:

- `linux-x11-xclip-uri-list`
- `linux-x11-xsel-uri-list`

Phase 2 backend candidate:

- `linux-native-helper`

Behavior:

- Detect X11 session explicitly.
- Prefer command backends when available.
- Treat `text/uri-list` as the initial file-oriented representation.
- Preserve room for GNOME- and file-manager-specific clipboard flavors in the
  helper path.

### Linux Wayland

Wayland support must be treated separately from X11 because the clipboard model
and tool ecosystem differ.

Phase 1 backend candidate:

- `linux-wayland-wl-copy-uri-list`

Phase 2 backend candidate:

- `linux-native-helper`

Behavior:

- Detect Wayland session explicitly.
- Prefer `wl-copy` when available for the first shipping milestone.
- Recognize that command-only Wayland support has a lower compatibility ceiling
  than a dedicated helper because different targets may expect different MIME
  offerings.

### macOS

macOS should be designed around a native pasteboard implementation.

Phase 1 backend candidate:

- none beyond path-text fallback if no native path exists yet

Phase 2 backend candidate:

- `macos-native-helper`

Behavior:

- Detect macOS directly.
- Design the backend contract around pasteboard file objects and file URLs.
- Keep path-text fallback available even if native pasteboard integration is not
  ready.

## Backend Selection Rules

ZotClip should use explicit capability detection rather than a simple `if win /
else` branch.

Suggested priority order:

1. Native backend for the active platform
2. Platform command backend that writes a file-oriented format
3. Generic URI-list backend if meaningful on the platform
4. Path-text fallback

Backend selection inputs:

- operating system
- Linux session type: X11 vs Wayland
- command availability: `wl-copy`, `xclip`, `xsel`
- backend self-checks
- future helper availability

Availability failures should carry actionable messages so the preferences UI can
tell the user exactly what is missing.

## UI Changes

### Reader Toolbar Button

Add a dedicated reader toolbar button:

- icon: existing ZotClip icon
- label: localized "Copy Current Reader Attachment"
- tooltip: include current reader shortcut if configured
- disabled state: when no eligible reader attachment is available
- click handler: dispatch reader copy command through the orchestrator

The button should be added and removed with reader window/tab lifecycle hooks,
not by relying on hard-coded global state only.

### Preferences

Replace the current reader `Ctrl+C` mode UI with explicit shortcut settings.

New settings:

- `libraryShortcut`
- `readerShortcut`
- existing attachment-type settings remain
- existing multi-attachment strategy remains
- add backend diagnostics section

Preferences behavior:

- `libraryShortcut` defaults to `Ctrl+C`
- `readerShortcut` defaults to empty
- users can record, edit, or clear both shortcuts
- invalid shortcuts are rejected with inline validation
- conflicting shortcuts should surface a warning before save
- diagnostics should show active platform/session, detected commands, active
  backend, and missing dependency hints

### Notifications

Expand copy notifications to communicate result class clearly.

Suggested result categories:

- `copied-files`
- `copied-file-uris`
- `copied-path-text-fallback`
- `backend-unavailable`
- `dependency-missing`
- `copy-failed`

The notification layer should format user-facing messages from structured
results, not from backend-specific strings.

## Shortcut Model

Introduce a shared shortcut module rather than hard-coding key logic in library
and reader hooks.

Responsibilities:

- normalize stored shortcut strings
- parse modifier/key combinations
- match keyboard events
- format shortcuts for menus, tooltips, and preferences
- support disabled shortcuts as an empty value

Behavioral rules:

- library shortcut handler remains enabled by default
- reader shortcut handler is only active when a non-empty shortcut is set
- `Ctrl+C` in the reader remains native unless the user explicitly assigns it
  back to ZotClip

## Diagnostics

Cross-platform clipboard support will be hard to debug without first-class
diagnostics.

Add a diagnostics model that can power both logs and the preferences UI:

- detected platform
- Linux session type
- detected commands
- active backend
- attempted backends
- failure reason
- fallback reason

This information should be surfaced without forcing users to inspect logs.

## File and Module Plan

Expected refactor targets:

- Keep:
  - [attachmentResolver.ts](/D:/Projects/ZotClip/src/modules/copy/attachmentResolver.ts)
  - [attachmentTypes.ts](/D:/Projects/ZotClip/src/modules/copy/attachmentTypes.ts)
  - [copyCommands.ts](/D:/Projects/ZotClip/src/modules/copy/copyCommands.ts)
- Split or replace:
  - [clipboardWriter.ts](/D:/Projects/ZotClip/src/modules/copy/clipboardWriter.ts)
  - [readerHook.ts](/D:/Projects/ZotClip/src/modules/copy/readerHook.ts)
- Add likely modules:
  - `src/modules/copy/clipboard/payload.ts`
  - `src/modules/copy/clipboard/backends.ts`
  - `src/modules/copy/clipboard/backendRegistry.ts`
  - `src/modules/copy/clipboard/platformDetection.ts`
  - `src/modules/copy/clipboard/commandRunner.ts`
  - `src/modules/copy/clipboard/linuxCommandBackends.ts`
  - `src/modules/copy/clipboard/windowsBackend.ts`
  - `src/modules/copy/clipboard/pathTextBackend.ts`
  - `src/modules/copy/shortcuts.ts`
  - `src/modules/copy/readerToolbarButton.ts`
  - `src/modules/copy/diagnostics.ts`

Preference-related changes:

- modify [addon/prefs.js](/D:/Projects/ZotClip/addon/prefs.js)
- modify [typings/prefs.d.ts](/D:/Projects/ZotClip/typings/prefs.d.ts)
- modify [src/utils/prefs.ts](/D:/Projects/ZotClip/src/utils/prefs.ts)
- modify
  [src/modules/preferenceScript.ts](/D:/Projects/ZotClip/src/modules/preferenceScript.ts)
- modify
  [addon/content/preferences.xhtml](/D:/Projects/ZotClip/addon/content/preferences.xhtml)
- modify locale files under
  [addon/locale](/D:/Projects/ZotClip/addon/locale)

Lifecycle integration:

- modify [src/hooks.ts](/D:/Projects/ZotClip/src/hooks.ts) to register the
  reader toolbar button and new shortcut behavior

## Testing Strategy

Unit tests should remain the primary iteration loop.

Add or update unit coverage for:

- backend registry priority and fallback order
- platform/session detection
- command availability probing
- clipboard payload construction
- Linux command backend argument generation
- shortcut parsing, normalization, and event matching
- reader toolbar button state logic
- preferences validation for shortcut fields
- notifications and diagnostics formatting

Manual verification should expand into a platform matrix:

- Windows
  - Explorer
  - WeChat
  - QQ
  - browser text/file targets
- Linux X11
  - file manager
  - Chrome/Chromium
  - Firefox
  - Telegram or equivalent chat target
- Linux Wayland
  - file manager
  - Chrome/Chromium
  - Firefox
  - Telegram or equivalent chat target
- macOS
  - Finder
  - browser target
  - chat target if available

## Delivery Phases

### Phase 1: Refactor Without Behavior Change

- Introduce the payload model and backend interface.
- Wrap current Windows and path-text behavior behind the new orchestrator.
- Preserve current Windows behavior.

### Phase 2: Shortcut and Reader UI Overhaul

- Remove default reader `Ctrl+C` interception.
- Add configurable library and reader shortcuts.
- Add the reader toolbar button.
- Update menus, tooltips, notifications, and preferences.

### Phase 3: Linux Command Backends

- Detect X11 vs Wayland.
- Add `xclip`, `xsel`, and `wl-copy` probing and execution.
- Expose dependency diagnostics.

### Phase 4: Linux Compatibility Hardening

- Evaluate real target-app behavior.
- Add helper-based Linux backend if command-only compatibility is insufficient.

### Phase 5: macOS Native Backend

- Add native pasteboard transport for file copy.
- Keep path-text fallback and diagnostics.

## Risks

- Linux clipboard behavior differs significantly across X11, Wayland, desktop
  environments, and target applications.
- Command-only Linux support may not satisfy every target app, especially on
  Wayland.
- Reader toolbar integration depends on stable Zotero reader extension points
  or a robust DOM attachment strategy.
- Shortcut capture UX can become confusing if normalization and validation are
  not strict.
- macOS native pasteboard support may require helper tooling earlier than other
  platforms.

## Open Implementation Questions

- Which exact Zotero reader lifecycle hook or DOM anchor is the most stable
  insertion point for the toolbar button?
- How should command execution be abstracted so unit tests can cover platform
  behavior without invoking real system commands?
- At what failure threshold should Linux helper work be promoted from optional
  phase to required milestone?
- Should diagnostics be visible inline in preferences only, or also through a
  dedicated "copy test" action?

## External Constraints Informing This Design

- `wl-copy` is useful for initial Wayland support but is not a complete answer
  for broad multi-target file clipboard compatibility.
- X11 file copy conventions are less standardized than Windows clipboard file
  objects, so Linux support needs backend flexibility rather than a single
  hard-coded format.
- macOS file clipboard support should be designed around native pasteboard
  objects rather than plain text clipboard writes.

