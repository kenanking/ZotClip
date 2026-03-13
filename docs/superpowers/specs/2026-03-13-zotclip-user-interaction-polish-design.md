# ZotClip User Interaction Polish Design

Date: 2026-03-13

## Goal

Polish three user-facing areas in ZotClip without expanding scope into broader
clipboard architecture work:

- localize copy-result notifications and related reader-button strings
- clarify library/reader shortcut behavior in preferences
- show simple Linux install commands in compatibility diagnostics when required
  clipboard helpers are missing

The language rule is intentionally narrow:

- use Chinese when Zotero UI language starts with `zh`
- use English for every other language

## Current Context

The relevant code already exists:

- `src/modules/copy/notifier.ts` formats copy-result messages with hard-coded
  English strings
- `src/modules/copy/readerToolbarButton.ts` already creates a reader toolbar
  button, but its label and tooltip are not localized
- `src/modules/preferenceScript.ts` and `addon/content/preferences.xhtml`
  already manage shortcut settings and diagnostics rendering
- `src/utils/prefs.ts` already builds clipboard diagnostics from platform and
  command probing

This means the work is a focused UX pass, not a new subsystem.

## Design

### 1. Notification and Reader-UI Localization

Replace hard-coded English notification text with a small localized message
layer that maps structured copy results to:

- a stable message key
- a small set of interpolation values such as attachment count or missing
  dependency name

Formatting should then select Chinese or English based on the current Zotero UI
language. The same thin language switch should also provide the reader toolbar
button label, tooltip suffixes, and disabled-state messages so reader UI and
notifications stay consistent.

The implementation should remain intentionally small: only `zh*` gets Chinese,
everything else defaults to English.

### 2. Shortcut Preference Copy

Update the preference help text for shortcuts to clearly state:

- item-pane and reader-pane shortcuts are separate
- the item pane may use `Ctrl+C`
- `Ctrl+C` inside the reader keeps its original reader behavior and is not
  overridden by default
- the reader has no default shortcut; users may set one if desired

No behavioral expansion is needed beyond reinforcing the existing contract:

- library shortcut remains active by default
- reader shortcut stays empty by default
- reader shortcut handling only activates when the preference is non-empty

### 3. Reader Toolbar Button

Keep the existing reader toolbar button architecture and wire it into the same
localized string source used by notifications.

Behavior:

- the button appears in the reader toolbar
- clicking it copies the currently opened attachment file
- this applies to the current PDF or another reader-backed local file
- if no eligible local file is available, the button stays disabled and exposes
  a localized reason through its tooltip

The button is the primary reader entry point. The reader shortcut remains
optional and opt-in.

### 4. Compatibility Diagnostics With Simple Install Commands

Extend Linux diagnostics rendering so missing clipboard commands also show one
simple install command. The goal is not exhaustive support; it is just enough
guidance for common Ubuntu-like setups.

Rules:

- Wayland + missing `wl-copy` → recommend `sudo apt install wl-clipboard`
- X11 + missing `xclip` → recommend `sudo apt install xclip`
- unknown Linux session → show the simplest command for the first preferred
  missing helper instead of presenting a long matrix

The message may end with a short note telling users to troubleshoot their own
environment if the simple install path is not enough.

Non-Linux diagnostics remain unchanged.

## Error Handling

- If the language cannot be determined, fall back to English.
- If copy fails for reasons outside the structured outcomes, show the existing
  generic failure path, but localized.
- If diagnostics gathering fails, keep the existing diagnostics-unavailable
  behavior and localize that fallback text as well where practical.

## Testing

Add or update targeted unit tests for:

- copy-result notification formatting in Chinese and English
- localized reader toolbar button labels/tooltips/disabled messages
- shortcut preference text and reader-default behavior assumptions where current
  tests already cover the UI wiring
- Linux diagnostics install-command rendering for missing `wl-copy` and `xclip`

Before completion, run:

- `npm run test:unit`
- `npm run build`
- `npm run lint:check`
