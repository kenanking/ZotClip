# ZotClip Manual Testing

## Test Environment

- Zotero 8 or 9 is installed.
- At least one parent item contains multiple allowed attachments.
- At least one reader-openable attachment is available.
- Platform packages are installed before testing:
  - Windows: nothing extra
  - Linux X11: `python3-gi` and `gir1.2-gtk-4.0`
  - Linux Wayland: `wl-clipboard`
  - macOS: implementation exists, but this checklist does not currently claim validation

## Library Copy

- [ ] Select one allowed attachment in the library view.
- [ ] Press `Ctrl+C`.
- [ ] Confirm a success notification appears.
- [ ] Paste into a file-aware target and confirm the attachment is pasted as a
      file, not as text.
- [ ] Open the item context menu and trigger `Copy Attachment File(s)`.
- [ ] Paste again and confirm the same result.
- [ ] Repeat the same copy command several times on the same selection and confirm there is no visible lag increase after the first successful copy.
- [ ] Select a larger set of parent items with multiple allowed attachments and confirm the copy command remains responsive.

## Reader Copy

- [ ] Open an allowed attachment in the reader.
- [ ] Confirm the ZotClip toolbar button is visible in the reader toolbar.
- [ ] Open the same attachment in a standalone reader window and confirm the button is visible there as well.
- [ ] Select text inside the reader and press `Ctrl+C`.
- [ ] Confirm the default text copy behavior is unchanged.
- [ ] Click the ZotClip toolbar button and confirm the current attachment is
      copied.
- [ ] Open a reader state where the current attachment cannot be copied and confirm the button stays visible but disabled with an explanatory tooltip.
- [ ] Switch between multiple reader tabs and confirm the reader toolbar button state updates without visible lag.
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
- [ ] Move focus repeatedly between the item list, reader, and other Zotero panes and confirm the main toolbar button state remains correct without repeated visible refresh lag.

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
- [ ] Reopen the compatibility section multiple times and confirm backend diagnostics remain stable without visible probe delays after the first check.

## Fallback Behavior

- [ ] Trigger copy in a target that does not accept file clipboard data.
- [ ] Confirm ZotClip falls back to copying attachment paths as plain text.
- [ ] Confirm the notification explains that a path-text fallback was used.

## Platform Smoke Tests

- [ ] Windows: paste into Explorer and one chat or browser target that accepts files.
- [ ] Linux X11: paste into a file manager and one browser or chat target.
- [ ] Linux Wayland: paste into a file manager and one browser or chat target.
- [ ] macOS: not currently part of the validated runtime smoke test matrix.
