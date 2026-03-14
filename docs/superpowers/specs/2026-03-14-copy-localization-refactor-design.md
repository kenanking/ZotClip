# Copy Localization Refactor Design

Date: 2026-03-14

## Goal

Refactor the `copy` module so every user-visible message uses the project's
Fluent locale files instead of code-localized English and Chinese branches.

The refactor removes free-form English message strings from the copy pipeline
and replaces them with stable message keys and interpolation args that are
resolved through `addon/locale/*.ftl`.

## Current Problems

- `src/modules/copy/notifier.ts` formats user-visible notification text inside
  TypeScript.
- `src/modules/copy/uiStrings.ts` implements a narrow "Chinese or English"
  branch by matching English source strings and translating only known values.
- Clipboard backends and diagnostics currently surface English text as data,
  which makes those strings part of the runtime contract.
- The repository already has a Fluent locale system, but the `copy` module does
  not consistently use it.

This design treats the current approach as transitional code and removes it
instead of preserving compatibility.

## Design Principles

- User-visible messages must come from Fluent files only.
- Runtime logic must exchange stable message identifiers, never English text.
- Business outcomes and display text must be separate concerns.
- The `copy` module should support future languages without adding language
  branches in TypeScript.
- Existing code paths should be simplified instead of carrying legacy message
  shims.

## Architecture

### Structured Messages

Replace free-form message text in copy results with a structured message
descriptor:

- `messageKey`: a stable key for a user-visible message
- `messageArgs`: interpolation values passed to Fluent

`ClipboardResult.outcome` remains the business-level result. It is not the same
thing as a locale key. Some outcomes may use a direct message key, while others
may use a formatter that derives the final locale key from the outcome and
format metadata.

### Fluent as the Single Rendering Layer

All copy-related UI text will be resolved through the existing locale utilities
and stored in:

- `addon/locale/en-US/addon.ftl`
- `addon/locale/zh-CN/addon.ftl`

No copy-related code should build Chinese or English user text directly after
the refactor.

### Separation of Responsibilities

- Clipboard backends and status probes emit structured result metadata and
  message keys.
- Copy UI helpers map structured results to locale keys and interpolation args
  when needed.
- `utils/locale.ts` remains the only text rendering mechanism for these
  messages.
- Notifications, diagnostics, and reader UI consume the same locale-backed
  message source.

## Data Model

### ClipboardResult

Refactor `ClipboardResult` so it no longer contains `message?: string`.

Instead it will expose:

- `messageKey?: CopyMessageKey`
- `messageArgs?: Record<string, string | number>`

`CopyMessageKey` should be a constrained union covering every user-visible
message produced by the `copy` module, including:

- missing file / missing reader attachment messages
- backend-unavailable and dependency-missing reasons
- clipboard write failure and generic failure messages
- fallback-to-path-text messages
- success notifications for copied files and file URIs

If diagnostics need additional line-level messages, they should use their own
typed line descriptor instead of embedding rendered strings.

### Diagnostics Model

`buildClipboardDiagnostics()` should stop assembling localized strings. Instead
it should return structured diagnostics data, including typed line descriptors
for:

- platform line
- command availability lines
- active backend line
- fallback note line
- install command line
- optional manual troubleshooting note

The preferences UI or a focused formatter should render those descriptors
through Fluent.

## Files in Scope

### Core Type and Formatting Changes

- Modify `src/modules/copy/types.ts`
- Modify `src/modules/copy/notifier.ts`
- Create or modify a focused copy-message formatting module if needed

### Copy Pipeline Message Producers

- Modify `src/modules/copy/clipboardWriter.ts`
- Modify clipboard backend/status modules under `src/modules/copy/clipboard/`
- Modify any copy command helpers that currently surface English user-facing
  text

### Diagnostics and Preferences

- Modify `src/modules/copy/clipboard/diagnostics.ts`
- Modify `src/utils/prefs.ts`
- Modify preference rendering code if it currently expects pre-rendered strings

### Reader UI

- Modify `src/modules/copy/readerToolbarButton.ts` and any availability message
  producers that currently pass rendered text

### Locale Assets

- Modify `addon/locale/en-US/addon.ftl`
- Modify `addon/locale/zh-CN/addon.ftl`
- Regenerate or update `typings/i10n.d.ts` as required by the repo's locale
  tooling

### Removal

- Delete `src/modules/copy/uiStrings.ts`

## Message Strategy

There are two acceptable patterns inside the refactor:

1. Producers return final `messageKey/messageArgs` directly.
2. Producers return structured outcome metadata and a formatter derives the
   final `messageKey/messageArgs`.

The implementation should choose the smaller surface that keeps copy modules
cohesive. The main rule is that English text must not be part of the runtime
contract anymore.

## Error Handling

- All expected user-visible failures must map to stable locale keys.
- Unknown failures should collapse to one generic locale key instead of leaking
  arbitrary raw text to the UI.
- Missing optional interpolation args should fail closed to a safe generic
  message rather than producing broken copy.
- Diagnostics rendering should continue to work even if some command/backend
  metadata is unavailable.

## Testing Strategy

Update tests to validate behavior at the message-structure and locale-rendering
boundaries.

### Required Test Coverage

- `ClipboardResult` producers emit the expected `messageKey/messageArgs`
- Notification formatting renders the expected Fluent messages
- Diagnostics builders emit structured descriptors instead of rendered strings
- Diagnostics rendering produces the expected localized lines
- Reader availability messaging resolves through locale keys instead of inline
  strings

### TDD Constraint

Implementation should proceed test-first:

1. write failing tests for the new structured message contract
2. verify failures are caused by the missing refactor
3. implement the minimal code to pass
4. refactor while keeping tests green

## Implementation Order

1. Introduce typed message keys and args in copy types.
2. Update clipboard producers to emit structured messages.
3. Move notification and diagnostics rendering to Fluent-backed formatting.
4. Add locale entries and update generated locale typing.
5. Remove `uiStrings.ts` and any remaining direct language branches.
6. Run unit tests, build, and lint checks.

## Non-Goals

- No backward-compatibility layer for the old free-form message strings
- No partial retention of the "Chinese else English" TypeScript translation
  path
- No unrelated clipboard architecture changes beyond what this refactor needs

## Expected Outcome

After the refactor, the `copy` module should have one message pipeline:

- logic returns structured keys and args
- Fluent locale files own all user-visible wording
- UI surfaces render through the existing locale utility

That leaves the module easier to test, easier to extend, and no longer fragile
to English text edits.
