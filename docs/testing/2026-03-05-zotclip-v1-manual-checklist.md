# ZotClip v1 Manual Checklist

## Environment

- Zotero 8 installed
- Windows target system
- At least one regular item with multiple PDF attachments

## Library Copy Flow

- [ ] Select one PDF attachment item in library view.
- [ ] Press `Ctrl+C`.
- [ ] Confirm the success notification appears.
- [ ] Paste into Explorer or another file-aware target and confirm the file is
      pasted as a file object.
- [ ] Trigger `Copy PDF File(s)` from the item context menu.
- [ ] Paste into Explorer or another file-aware target and confirm the file is
      pasted as a file object.

## Multi-PDF Strategy

- [ ] Set `Multi-PDF Strategy` to `Copy all PDF attachments`.
- [ ] Select a parent item with multiple PDF attachments.
- [ ] Trigger copy and confirm multiple files are copied.
- [ ] Paste into Explorer or another file-aware target and confirm all files
      appear as pasted files, not as text.
- [ ] Switch to `Copy only the primary PDF attachment`.
- [ ] Trigger copy again and confirm only one file is copied.

## Reader Copy Flow

- [ ] Open a PDF in Zotero reader.
- [ ] Select some text and press `Ctrl+C`; confirm text copy behavior is unchanged.
- [ ] Clear text selection and press `Ctrl+C`; confirm the current PDF is copied
      as a file object.
- [ ] Press `Ctrl+Shift+C`; confirm the current PDF is copied as a file object.

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
