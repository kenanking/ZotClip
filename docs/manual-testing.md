# ZotClip Manual Testing

## Test Environment

- Zotero 8, 9, or 10 is installed; test all supported major versions before release.
- At least one parent item contains multiple allowed attachments.
- At least one reader-openable attachment is available.
- Platform packages are installed before testing:
  - Windows: nothing extra
  - Linux X11: `python3-gi` and `gir1.2-gtk-4.0`
  - Linux Wayland: `wl-clipboard`
  - macOS: no extra package, but validate both single-file and multi-file pasteboard copy on a real device before release

## Library Copy

- [ ] Select one allowed attachment in the library view.
- [ ] Press `Ctrl+C`.
- [ ] Confirm a success notification appears.
- [ ] Paste into a file-aware target and confirm the attachment is pasted as a
      file, not as text.
- [ ] Open the item context menu and trigger `Copy Attachment File(s)`.
- [ ] Paste again and confirm the same result.

## Reader Copy

- [ ] Open an allowed attachment in the reader.
- [ ] Confirm the ZotClip toolbar button is visible in the reader toolbar.
- [ ] Open the same attachment in a standalone reader window and confirm the button is visible there as well.
- [ ] Select text inside the reader and press `Ctrl+C`.
- [ ] Confirm the default text copy behavior is unchanged.
- [ ] Click the ZotClip toolbar button and confirm the current attachment is
      copied.
- [ ] Open a reader state where the current attachment cannot be copied and confirm the button stays visible but disabled with an explanatory tooltip.
- [ ] Set a reader shortcut such as `Ctrl+Shift+C` in `Edit -> Preferences -> ZotClip`.
- [ ] Press the configured shortcut and confirm the current attachment is copied.
- [ ] Clear the reader shortcut and confirm the reader no longer intercepts it.

## Toolbar Preferences

- [ ] Open `Edit -> Preferences -> ZotClip`.
- [ ] Confirm `Show Main Toolbar Button` is enabled by default.
- [ ] Confirm `Show Reader Toolbar Button` is enabled by default.
- [ ] Disable `Show Main Toolbar Button` and confirm the main-window toolbar button disappears while the reader button remains available.
- [ ] Re-enable `Show Main Toolbar Button`.
- [ ] Disable `Show Reader Toolbar Button` and confirm reader toolbar buttons disappear in both reader tabs and standalone reader windows while the main-window button remains available.
- [ ] Re-enable `Show Reader Toolbar Button`.

## Attachment Rules

- [ ] Open `Edit -> Preferences -> ZotClip`.
- [ ] Confirm the preset attachment types are shown.
- [ ] Disable one allowed type such as `EPUB` and confirm that type is skipped.
- [ ] Re-enable the type and confirm it is copied again.
- [ ] Enter a custom extension such as `djvu` and confirm the value is normalized.
- [ ] Clear all allowed types and confirm the settings page shows a validation error.

## Multi-Attachment Behavior

- [ ] Set `Multi-Attachment Strategy` to `Copy all allowed attachments`.
- [ ] Copy a parent item that has multiple allowed attachments.
- [ ] Paste into a file-aware target and confirm all allowed files are present.
- [ ] Copy multiple allowed attachments that share the same file name.
- [ ] Confirm the pasted files keep the first original name and suffix later duplicates as `_1`, `_2`, and so on.
- [ ] Switch to `Copy only the primary allowed attachment`.
- [ ] Copy the same parent item again and confirm only one attachment is copied.

## Compatibility Checks

- [ ] Open `Edit -> Preferences -> ZotClip`.
- [ ] Confirm the `Compatibility` section shows the current platform.
- [ ] Confirm `Backend diagnostics` reports the expected backend:
      Windows native, Linux X11 GTK4 helper, Linux Wayland `wl-copy`, or macOS `osascript`.
- [ ] If a required dependency is intentionally removed, confirm diagnostics show
      the missing dependency and an install command.
- [ ] Restore the dependency and confirm diagnostics report a working backend again.

## Fallback Behavior

- [ ] Make the native file backend unavailable (for example, use an isolated Linux environment without GTK4 and wl-copy).
- [ ] Confirm ZotClip falls back to copying attachment paths as plain text.
- [ ] Confirm the notification explains that a path-text fallback was used.
- [ ] Do not expect automatic fallback based on the destination application: ZotClip cannot observe whether a later paste is accepted.

## Platform Smoke Tests

- [ ] Windows: paste into Explorer and one chat or browser target that accepts files.
- [ ] Linux X11: paste into a file manager and one browser or chat target.
- [ ] Linux Wayland: paste into a file manager and one browser or chat target.
- [ ] macOS: paste a single copied attachment into Finder and one file-aware chat or browser target.
- [ ] macOS: paste multiple copied attachments into Finder and confirm every file is preserved.
- [ ] macOS: force native file copy failure if possible and confirm ZotClip falls back to plain-text paths with the fallback notification.

## Shortcut and Toolbar Races

- [ ] Copy from the item list and immediately change selection; confirm the original selection is copied.
- [ ] Repeat while changing attachment settings; the original operation keeps its settings.
- [ ] Select an item with no allowed local attachment and copy: show a failure notification without also running Zotero's native item copy.
- [ ] Copy text in quick search, item metadata, notes, and the collections tree; native behavior stays intact.
- [ ] Test configured reader shortcuts in both reader tabs and standalone windows.
- [ ] Hold a shortcut down and use an IME: repeats and composing events must not trigger multiple copies.
- [ ] Reload/disable/re-enable the plugin with main and reader windows open; buttons appear once and commands run once.
- [ ] Open and close readers rapidly during attachment lookup; no stale button or error appears after closing.

## Clipboard Lifetime

- [ ] Copy duplicate names including `paper.pdf`, `Paper.pdf`, and `paper_1.pdf`; every pasted file has a distinct name and correct contents.
- [ ] Paste after 60 seconds and again after several minutes while Zotero stays open.
- [ ] Reload the plugin and confirm temporary duplicate files are still present; on X11, copy again to create a new clipboard owner.
- [ ] Quit and restart Zotero; previous-session temporary directories are removed.
- [ ] On X11, replace the clipboard in another application; the ZotClip helper exits.
- [ ] On X11, disable the plugin while it owns the clipboard; its helper exits.

## AI Reliability and Credentials

- [ ] Start manual tagging, cancel while a request is pending, and confirm no new tags appear from that response.
- [ ] Turn off AI tagging during a batch; active requests and queued tasks stop.
- [ ] Run manual and automatic tagging for the same item; only one concurrent request is sent.
- [ ] Delete an item or lose group write permission during a request; its response must not change tags.
- [ ] Fail one item in a multi-item batch; later items still run.
- [ ] Zotero 10: undo/redo a manual tag update; automatic tagging does not add undo steps.
- [ ] Save, replace, and delete a synthetic key. Reopen preferences: the input is empty and saved status is correct.
- [ ] Switch providers and endpoint origins; one origin's saved key is not used for another.
- [ ] Migrate a synthetic old key preference; clear it only after login-manager verification. Simulate unavailable storage and confirm the preference remains for retry.
- [ ] Start a connection/model-list request, then switch provider, edit endpoint, close preferences, or disable the plugin. No stale response updates the UI.
- [ ] Inspect failures using synthetic data: no API key, request body, abstract, or full endpoint URL appears in plugin diagnostics.

## AI Task Feedback

- [ ] Start a manual batch: only one bottom-right card appears, with no separate footer or floating progress window.
- [ ] A single-item request shows an indeterminate progress indicator; a batch shows the current item and overall item progress.
- [ ] Start the command again while it runs: focus the existing task and do not submit another batch.
- [ ] Cancel once: the control switches to cancelling and cannot be triggered again. Completed tags remain; the summary stays until closed.
- [ ] Let all items finish successfully: the result stays in the same card and dismisses after six seconds. Hover/focus prevents dismissal.
- [ ] Fail one of several items: keep the summary visible. Retry requests only failed items using current API settings.
- [ ] Import a batch for automatic tagging: successes do not create popups. Failures produce one batch summary; with an active manual card, show the warning inside it.
- [ ] Disable the plugin or close its window during a request: remove the card and cancel the task.
- [ ] Inspect narrow windows, light/dark themes, Chinese/English labels, and keyboard navigation through Cancel/Retry/Close.

### Unified notifications

- [ ] Copy an attachment while an AI task is running: both cards use the same rounded surface and typography, stack without overlap, and the task remains cancellable.
- [ ] Confirm both task and notification headers display a 16px logo, an 8px gap and vertically centered title text. Neither card has an external shadow, including after reinstalling a same-version test XPI.
- [ ] Copy repeatedly: only the latest ordinary notification remains; closing it does not close or cancel the AI task.
- [ ] Verify copy feedback in both the library and a standalone reader. Trigger connection tests and unavailable model feedback from settings: notifications must appear in the main window, even if a standalone reader is active.
- [ ] Ordinary notifications dismiss after 5 seconds (7 seconds for path fallback). Hover or focus a card to keep it open; the Close button dismisses it immediately.
- [ ] Verify long error messages wrap inside the card and the card stack scrolls in a short window. Check light/dark themes and keyboard focus.
- [ ] Disable the plugin or close a window: cards and their timers are removed.

### API key presence

- [ ] Reopen settings with a saved key: the placeholder indicates it is saved and can be replaced; the actual input value remains empty.
- [ ] Delete the saved key or switch provider: the placeholder reflects the new state. Storage errors appear below the input, without displaying raw localization IDs or credentials.
