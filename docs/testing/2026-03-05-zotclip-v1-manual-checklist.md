# ZotClip v1 Manual Checklist

## Environment

- Zotero 8 installed
- Windows target system
- At least one regular item with multiple PDF attachments

## Library Copy Flow

- [ ] Select one PDF attachment item in library view.
- [ ] Trigger `Copy PDF File(s)` from the item context menu.
- [ ] Paste into File Explorer and confirm the file is copied.

## Multi-PDF Strategy

- [ ] Set `Multi-PDF Strategy` to `Copy all PDF attachments`.
- [ ] Select a parent item with multiple PDF attachments.
- [ ] Trigger copy and confirm multiple files are copied.
- [ ] Switch to `Copy only the primary PDF attachment`.
- [ ] Trigger copy again and confirm only one file is copied.

## Reader Copy Flow

- [ ] Open a PDF in Zotero reader.
- [ ] Select some text and press `Ctrl+C`; confirm text copy behavior is unchanged.
- [ ] Clear text selection and press `Ctrl+C`; confirm current PDF file copy is triggered.
- [ ] Press `Ctrl+Shift+C`; confirm current PDF file copy is triggered as fallback.

## Clipboard Fallback

- [ ] Use a destination app that does not accept file-object paste.
- [ ] Trigger copy and confirm path-text fallback message appears.
- [ ] Confirm pasted content is absolute file path text.

## Preferences

- [ ] Toggle `Allow path-text fallback` off.
- [ ] Trigger copy in an unsupported destination and confirm operation reports failure.
- [ ] Toggle fallback on again and confirm fallback copy works.
