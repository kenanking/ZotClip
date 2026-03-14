# ZotClip Manual Testing

## Environment

- Zotero 8 installed
- At least one regular item with mixed attachment types (`PDF`, `EPUB`, `TXT`)
- At least one reader-openable attachment
- Platform-specific clipboard dependencies installed where required:
  - Windows: none
  - Linux X11: `python3-gi`, `gir1.2-gtk-4.0`
  - Linux Wayland: `wl-clipboard`
  - macOS: `osascript`

## Library Copy Flow

- [ ] Select one allowed attachment item in library view.
- [ ] Press `Ctrl+C`.
- [ ] Confirm the success notification appears.
- [ ] Paste into Explorer or another file-aware target and confirm the file is
      pasted as a file object.
- [ ] Trigger `Copy Attachment File(s)` from the item context menu.
- [ ] Paste into Explorer or another file-aware target and confirm the file is
      pasted as a file object.

## Allowed Attachment Types

- [ ] Open `Edit -> Preferences -> ZotClip`.
- [ ] Confirm `PDF`, `EPUB`, `MOBI`, and `TXT` preset type checkboxes are shown.
- [ ] Disable `EPUB` and confirm an EPUB attachment is no longer copied.
- [ ] Re-enable `EPUB` and confirm it is copied again.
- [ ] Enter a custom extension such as `djvu` and confirm the value is
      normalized.
- [ ] Clear all preset and custom types and confirm the pane shows a validation
      error.

## Multi-Attachment Strategy

- [ ] Set `Multi-Attachment Strategy` to `Copy all allowed attachments`.
- [ ] Select a parent item with multiple allowed attachments.
- [ ] Trigger copy and confirm multiple allowed files are copied.
- [ ] Paste into Explorer or another file-aware target and confirm all files
      appear as pasted files, not as text.
- [ ] Switch to `Copy only the primary allowed attachment`.
- [ ] Trigger copy again and confirm only one file is copied.

## Reader Copy Flow

- [ ] Open an allowed attachment in Zotero reader.
- [ ] Confirm the ZotClip toolbar button is visible in the reader.
- [ ] Select some text and press `Ctrl+C`; confirm text copy behavior is
      unchanged.
- [ ] Click the ZotClip toolbar button and confirm the current attachment is
      copied.
- [ ] Configure a reader shortcut such as `Ctrl+Shift+C` in preferences.
- [ ] Press the configured reader shortcut and confirm the current attachment is
      copied.
- [ ] Clear the reader shortcut in preferences and confirm the reader stops
      intercepting keyboard copy.
- [ ] Disable the current attachment type in preferences and confirm reader copy
      is disabled and the toolbar button shows an unavailable state.

## Clipboard Fallback

- [ ] Trigger copy in a target that rejects native file clipboard data.
- [ ] Confirm the notification explains that a path-text fallback was used.
- [ ] Confirm pasted content is absolute file path text.

## Preferences Diagnostics

- [ ] Open `Edit -> Preferences -> ZotClip`.
- [ ] Confirm the diagnostics section shows platform and active backend.
- [ ] Confirm Linux X11 reports `gtk4-helper` availability and the GTK4 helper backend.
- [ ] Confirm Linux Wayland reports `wl-copy` availability and the Wayland backend.
- [ ] Confirm macOS reports `osascript` availability.
- [ ] Remove or hide a required dependency and confirm the diagnostics section
      reports the missing command and fallback reason.

## Optional X11 Clipboard Inspection

- [ ] On Linux X11, trigger attachment copy from Zotero.
- [ ] If `xclip` is installed as a debugging tool, run `xclip -selection clipboard -t text/uri-list -o | xxd -g 1`.
- [ ] Confirm the payload starts with `file:///`.
- [ ] If `xclip` is installed as a debugging tool, run `xclip -selection clipboard -t x-special/gnome-copied-files -o | xxd -g 1`.
- [ ] Confirm the payload starts with `copy\nfile:///`.
- [ ] Confirm the GNOME payload does not include an extra trailing empty entry.

## Platform Matrix

### Windows

- [ ] Paste copied files into Explorer.
- [ ] Paste copied files into WeChat or QQ.
- [ ] Paste copied files into a browser target that accepts file drops/paste.

### Linux X11

- [ ] Paste copied files into a file manager such as Nautilus.
- [ ] Paste into Chrome.
- [ ] Paste into Firefox.
- [ ] Paste into Telegram.
- [ ] Confirm GTK4 helper is the active backend before any fallback.

### Linux Wayland

- [ ] Paste copied files into a file manager.
- [ ] Paste into Chrome.
- [ ] Paste into Firefox.
- [ ] Paste into Telegram.
- [ ] Confirm `wl-copy` is the active backend before any fallback.

### macOS

- [ ] Paste copied files into Finder.
- [ ] Paste into a browser target that accepts file pastes.
- [ ] Paste into a chat target.
