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
  - Windows: writes native `CF_HDROP` file clipboard data for single and
    multiple files
  - non-Windows: tries file object first, then URI list
  - all platforms: fall back to absolute file path text only when file clipboard
    write fails and fallback is enabled

## Requirements

- Zotero 8
- Windows support depends on whether the target app accepts standard Windows
  file paste; path-text fallback remains available when it does not

## Usage

### Library

1. Select one or more items/attachments in library view.
2. Press `Ctrl+C` to copy the resolved PDF file to the clipboard.
3. Or open item context menu and click `Copy PDF File(s)`.

### Reader

1. Open a PDF in reader.
2. Press `Ctrl+C`:
   - with text selection: native text copy
   - without text selection: copy current PDF file to the clipboard
3. Press `Ctrl+Shift+C` to force copy of the current reader PDF file.

### Preferences

Open `Edit -> Preferences -> ZotClip` and configure:

- `Multi-PDF Strategy` (`all` or `primary`)
- `Reader Ctrl+C Behavior` (`smart`, `never`, `always`)
- `Allow path-text fallback`

## Windows Note

Windows targets expect native file clipboard data rather than `text/uri-list`
when pasting real files. ZotClip now writes `CF_HDROP` directly on Windows so
multi-file copy can paste as actual files into Explorer and other file-aware
targets, with path-text only as fallback.

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
