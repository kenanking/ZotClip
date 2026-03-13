<p align="center">
  <img src="./addon/content/icons/favicon.svg" width="72" alt="ZotClip icon">
</p>

# ZotClip

ZotClip is a small plugin for Zotero 8 that lets you copy attachment files to
the clipboard from either the library view or the reader. It is meant for the
simple case where a paper is already in Zotero and you want to paste the
underlying file directly into Explorer, chat apps, or any other file-aware
target.

Current platform behavior:

- Windows: native `CF_HDROP` file copy
- Linux X11: `xclip` `text/uri-list` clipboard backend
- Linux Wayland: `wl-copy` `text/uri-list` clipboard backend
- macOS: `osascript` Finder clipboard backend
- Fallback: absolute attachment path text when file-oriented clipboard copy is
  unavailable

## Installation

Download the latest `.xpi` from
[GitHub Releases](https://github.com/kenanking/ZotClip/releases). In Zotero,
open `Tools -> Plugins`, click the gear button, choose `Install Plugin From
File...`, and select the downloaded package. Restart Zotero if the plugin does
not appear immediately.

## Dependencies

ZotClip can ship without bundled helpers, but Linux and macOS rely on
system-provided clipboard commands:

- Linux X11: install `xclip`
- Linux Wayland: install `wl-clipboard` so `wl-copy` is available
- macOS: `osascript` is expected to be available from the system

If the preferred backend is unavailable, ZotClip falls back to copying absolute
attachment paths as plain text and shows the reason in notifications and in the
preferences diagnostics section.

## Usage

In the library view, select an attachment or a parent item and press `Ctrl+C`,
or use `Copy Attachment File(s)` from the context menu.

In the reader, ZotClip does not hijack the default `Ctrl+C`. Use the reader
toolbar button to copy the current attachment. If you want a keyboard shortcut
in the reader, configure one explicitly in `Edit -> Preferences -> ZotClip`.

The preferences pane lets you configure:

- allowed attachment types
- multi-attachment strategy
- library shortcut
- reader shortcut
- backend diagnostics for the current platform/session

## Development

For local development, run `npm install` and `npm run start`. Before opening a
PR, run `npm run test:unit`, `npm run build`, and `npm run lint:check`. Manual
verification notes live in [`docs/manual-testing.md`](docs/manual-testing.md).
