<p align="center">
  <img src="./addon/content/icons/favicon.svg" width="72" alt="ZotClip icon">
</p>

# ZotClip

[![zotero target version](https://img.shields.io/badge/Zotero-8%20%7C%209%20%7C%2010-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Latest release](https://img.shields.io/github/v/release/kenanking/ZotClip?style=flat-square)](https://github.com/kenanking/ZotClip/releases)
[![License](https://img.shields.io/github/license/kenanking/ZotClip?style=flat-square)](https://github.com/kenanking/ZotClip/blob/main/LICENSE)

ZotClip is a plugin for Zotero 8, 9, and 10 with two parallel feature areas:

- **Attachment clipboard copy** — from the library or reader, copy attachment
  files to the system clipboard. Target apps that accept file pastes receive
  files. If no file clipboard backend succeeds, ZotClip copies absolute paths
  as plain text. ZotClip cannot detect whether the eventual paste target accepts files.
- **AI tagging** — generate tags for selected library items using an
  OpenAI-compatible chat API. Built-in providers include DeepSeek, OpenRouter,
  Ollama, and LM Studio, plus a custom URL for other endpoints. Keys and prompts are
  configured in preferences.

## Installation

Download the latest `.xpi` from
[GitHub Releases](https://github.com/kenanking/ZotClip/releases). In Zotero,
open `Tools -> Plugins`, click the gear button, choose `Install Plugin From
File...`, and select the downloaded package. Restart Zotero if the plugin does
not appear immediately.

## System Support

| System        | Clipboard backend                     | What to install                                 |
| ------------- | ------------------------------------- | ----------------------------------------------- |
| Windows 10/11 | Native `CF_HDROP` file copy           | Nothing extra                                   |
| Linux X11     | GTK4 helper backend                   | `python3-gi` and `gir1.2-gtk-4.0`               |
| Linux Wayland | `wl-copy` `text/uri-list` backend     | `wl-clipboard`                                  |
| macOS         | `osascript` AppKit pasteboard backend | Nothing extra; `osascript` is provided by macOS |

After installation, open `Edit -> Preferences -> ZotClip` and check the
`Compatibility` section. Confirm that `Backend diagnostics` reports the
expected backend for your system and does not show a missing dependency. If the
compatibility check does not pass, install the required system package before
retesting. AI tagging does not use these clipboard backends; it only needs
network access to your chosen API (or a local Ollama instance).

## Usage

### Attachment clipboard copy

In the library view, select an attachment or a parent item and press `Ctrl+C`,
or use `Copy Attachment File(s)` from the item context menu. The shortcut is
claimed only in the item list with a selection; unavailable attachments produce
a notification. Search fields, editable text, and the collections tree keep their
normal copy behavior.

Copies with duplicate filenames use private temporary files retained for the
current Zotero session, including plugin reloads. Old session files are removed
at the next Zotero startup. Paste while Zotero is still running.

In the reader, ZotClip keeps the default `Ctrl+C` behavior for text selection.
Use the reader toolbar button to copy the current attachment. If you want a
reader-specific shortcut, configure one in `Edit -> Preferences -> ZotClip`.

### AI tagging

In the library, select one or more regular items and choose **Generate AI Tags**
from the item context menu (when AI tagging is enabled in preferences). You can
also opt into automatic tagging for newly added items and optional stripping of
Connector-import tags; see preferences for details. A manual batch uses one compact
task card with progress, the current item, and a cancel button. Successful results dismiss after six seconds (hover or focus
keeps them visible). Failures stay visible with a button to retry only failed
items; repeated commands focus the existing task. Automatic successes are silent,
and automatic failures are summarized in the same card. Turning off AI tagging
also cancels queued and active tasks.
Completed changes are kept; cancelled requests cannot add tags. In Zotero 10,
manual tag changes support the normal Undo/Redo commands (one item per step).
Background tagging does not add undo steps. Read-only and deleted items are skipped.

### Notifications

Copy results and settings feedback share the AI task card styling, with the plugin
logo and no external shadow. Ordinary notifications update a single card alongside
any active task, can be closed manually, and pause automatic dismissal while
hovered or focused. Settings feedback appears in the main Zotero window.

## Settings (`Edit -> Preferences -> ZotClip`)

**Copying:** allowed attachment types, multi-attachment strategy, library and
reader shortcuts, toolbar and context menu visibility, platform clipboard
diagnostics.

**AI tagging:** enable the feature, provider and model, API key and endpoint
(where applicable), optional connection test, and a prompt template with
`{title}`, `{abstract}`, and `{language}` placeholders.

API keys are saved explicitly in Zotero's login manager, separated by provider
and endpoint origin. The input is never prefilled with a saved key. Use **Save**
or **Delete** and check the status. Existing preference keys are migrated only
after successful storage verification; failed migrations retain the old value
for retry. Changing an endpoint to a different origin requires a key for that
origin. Prompts and other non-secret settings remain in preferences.

## Development

Install dependencies with `npm install`, then run `npm run start` for the local
development loop.

Before opening a PR, run:

- `npm run test:unit`
- `npm run build`
- `npm run lint:check`

Pinned Linux integration runs (fresh isolated profiles, production XPI installation):

```sh
node scripts/test-zotero.mjs 8.0.4
node scripts/test-zotero.mjs 9.0.6
node scripts/test-zotero.mjs 10.0.1
node --import tsx scripts/test-clipboard-x11.ts
```

The X11 test creates a separate Xvfb display and takes about a minute. Integration
logs are written to `.scaffold/validation/`. TypeScript remains pinned to 6.0.3.
See [`docs/validation.md`](docs/validation.md) for coverage and platform limits.

Manual verification notes live in [`docs/manual-testing.md`](docs/manual-testing.md).
