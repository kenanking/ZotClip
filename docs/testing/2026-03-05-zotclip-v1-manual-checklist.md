# ZotClip v1 Manual Checklist

## Environment

- Zotero 8 installed
- Windows target system
- At least one regular item with mixed attachment types (`PDF`, `EPUB`, `TXT`)

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
- [ ] Enter a custom extension such as `djvu` and confirm the value is normalized.
- [ ] Clear all preset and custom types and confirm the pane shows a validation error.

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
- [ ] Select some text and press `Ctrl+C`; confirm text copy behavior is unchanged.
- [ ] Clear text selection and press `Ctrl+C`; confirm the current attachment is
      copied as a file object.
- [ ] Press `Ctrl+Shift+C`; confirm the current attachment is copied as a file object.
- [ ] Disable the current attachment type in preferences and confirm reader copy fails.

## Clipboard Fallback

- [ ] Disable `Allow path-text fallback`.
- [ ] Trigger copy and confirm the operation reports Windows clipboard limitations.
- [ ] Enable `Allow path-text fallback`.
- [ ] Trigger copy and confirm the path-text success message appears.
- [ ] Confirm pasted content is absolute file path text.

## Preferences

- [ ] Toggle `Allow path-text fallback` off.
- [ ] Trigger copy in an unsupported destination and confirm operation reports failure.
- [ ] Toggle fallback on again and confirm fallback copy works.
