<p align="center">
  <img src="./addon/content/icons/favicon.svg" width="72" alt="ZotClip icon">
</p>

# ZotClip

ZotClip is a small plugin for Zotero 8 that lets you copy attachment files to
the clipboard from either the library view or the reader. It is meant for the
simple case where a paper is already in Zotero and you want to paste the
underlying file directly into Explorer, chat apps, or any other file-aware
target.

On Windows, ZotClip writes native file clipboard data so pasted attachments can
behave like real files where the target supports it. In the reader, `Ctrl+C`
keeps normal text copy when text is selected and can copy the current
attachment when nothing is selected, while `Ctrl+Shift+C` remains available as
an explicit attachment-copy shortcut.

## Installation

Download the latest `.xpi` from
[GitHub Releases](https://github.com/kenanking/ZotClip/releases). In Zotero,
open `Tools -> Plugins`, click the gear button, choose `Install Plugin From
File...`, and select the downloaded package. Restart Zotero if the plugin does
not appear immediately.

## Usage

In the library view, select an attachment or a parent item and press `Ctrl+C`,
or use `Copy Attachment File(s)` from the context menu. In the reader, `Ctrl+C`
keeps native text copying when text is selected; otherwise it can copy the
current attachment file instead.

If you want to adjust which files are eligible, how multi-attachment copy
behaves, or how reader copy should work, open `Edit -> Preferences -> ZotClip`.

## Development

For local development, run `npm install` and `npm run start`. Before opening a
PR, run `npm run test:unit`, `npm run build`, and `npm run lint:check`. Manual
verification notes live in [`docs/manual-testing.md`](docs/manual-testing.md).
