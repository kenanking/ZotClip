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
- Clipboard behavior:
  - Windows: copies absolute file path text
  - other platforms: tries file object, then URI list, then path text

## Requirements

- Zotero 8
- Windows is the primary target platform for v1 path-copy workflow

## Usage

### Library

1. Select one or more items/attachments in library view.
2. Press `Ctrl+C` to copy absolute file path text on Windows.
3. Or open item context menu and click `Copy PDF File(s)`.

### Reader

1. Open a PDF in reader.
2. Press `Ctrl+C`:
   - with text selection: native text copy
   - without text selection: copy current PDF file path text on Windows
3. Press `Ctrl+Shift+C` to force copy of current reader PDF file path text on Windows.

### Preferences

Open `Edit -> Preferences -> ZotClip` and configure:

- `Multi-PDF Strategy` (`all` or `primary`)
- `Reader Ctrl+C Behavior` (`smart`, `never`, `always`)
- `Allow path-text fallback`

## Windows Note

Zotero does not currently expose a reliable native Windows file clipboard API
for plugins. ZotClip therefore uses absolute path text on Windows so copy
actions remain deterministic instead of reporting a successful copy that
external apps cannot paste.

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
