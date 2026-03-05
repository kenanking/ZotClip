# ZotClip

ZotClip is a Zotero 8 plugin that copies PDF attachments to the clipboard.

## Features

- Copy PDF files from selected items or attachments in library view
- Reader `Ctrl+C` smart behavior:
  - keep native text copy when text is selected
  - copy current reader PDF file when no text is selected
- Fallback shortcut in reader: `Ctrl+Shift+C`
- Multi-PDF strategy options:
  - copy all PDF attachments
  - copy only the primary PDF attachment
- Clipboard fallback chain:
  - file object
  - URI list
  - path text (optional)

## Requirements

- Zotero 8
- Windows is the primary target platform for v1

## Usage

### Library

1. Select one or more items/attachments in library view.
2. Open item context menu.
3. Click `Copy PDF File(s)`.

### Reader

1. Open a PDF in reader.
2. Press `Ctrl+C`:
   - with text selection: native text copy
   - without text selection: copy current reader PDF file
3. Press `Ctrl+Shift+C` to force copy of current reader PDF file.

### Preferences

Open `Edit -> Preferences -> ZotClip` and configure:

- `Multi-PDF Strategy` (`all` or `primary`)
- `Reader Ctrl+C Behavior` (`smart`, `never`, `always`)
- `Allow path-text fallback`

## Development

```bash
npm install
npm run start
```

## Verification

```bash
npm run lint:check
npm run test:unit
npm run build
```

Manual checklist: `docs/testing/2026-03-05-zotclip-v1-manual-checklist.md`
