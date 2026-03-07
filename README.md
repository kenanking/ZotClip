# ZotClip

ZotClip is a Zotero 8 plugin that copies allowed attachment files to the
clipboard.

## Features

- Copy allowed attachment files from selected items or attachments in library
  view
- Configure allowed attachment types with built-in presets (`PDF`, `EPUB`,
  `MOBI`, `TXT`) plus custom extensions
- Reader `Ctrl+C` smart behavior:
  - keep native text copy when text is selected
  - copy the current reader attachment file when no text is selected
- Fallback shortcut in reader: `Ctrl+Shift+C`
- Multi-attachment strategy options:
  - copy all allowed attachments
  - copy only the primary allowed attachment
- Clipboard behavior:
  - Windows: writes native `CF_HDROP` file clipboard data for single and
    multiple files
  - non-Windows: tries file object first, then URI list
  - all platforms: fall back to absolute file path text when file clipboard
    write fails

## Requirements

- Zotero 8
- Windows support depends on whether the target app accepts standard Windows
  file paste; path-text fallback remains available when it does not

## Usage

### Library

1. Select one or more items/attachments in library view.
2. Press `Ctrl+C` to copy the resolved allowed attachment file(s) to the
   clipboard.
3. Or open item context menu and click `Copy Attachment File(s)`.

### Reader

1. Open an allowed attachment in reader.
2. Press `Ctrl+C`:
   - with text selection: native text copy
   - without text selection: copy the current attachment file to the clipboard
3. Press `Ctrl+Shift+C` to force copy of the current reader attachment file.

### Preferences

Open `Edit -> Preferences -> ZotClip` and configure:

- `Multi-Attachment Strategy` (`all` or `primary`)
- `Allowed Attachment Types` (preset checkboxes plus custom extensions)
- `Reader Ctrl+C Behavior` (`smart`, `never`, `always`)

## Windows Note

Windows targets expect native file clipboard data rather than `text/uri-list`
when pasting real files. ZotClip now writes `CF_HDROP` directly on Windows so
multi-file copy can paste as actual files into Explorer and other file-aware
targets, with path-text used only when native file clipboard write fails.

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

Manual checklist: `docs/manual-testing.md`
