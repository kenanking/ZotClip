# Duplicate Attachment Filenames Design

## Goal

When a copy operation includes multiple attachments that share the same file
name and extension, ZotClip should keep the first attachment's file name
unchanged and expose the remaining attachments as uniquely named files such as
`name_1.pdf`, `name_2.pdf`, and so on. This prevents paste targets from
reporting overwrite conflicts for duplicate file names.

## Current State

- The copy pipeline resolves attachments to their original file paths.
- Clipboard payload generation forwards those original paths directly to every
  platform backend.
- If multiple attachments point to different source files but share the same
  visible file name and extension, paste targets receive duplicate names and
  prompt for overwrite handling.

## Scope

In scope:

- Detect duplicate attachment file names within a single copy operation.
- Materialize uniquely named temporary copies for conflicting attachments.
- Keep existing clipboard backends unchanged by feeding them prepared paths.
- Add focused unit tests for duplicate-name preparation and clipboard usage.

Out of scope:

- New user preferences or UI toggles.
- Renaming the original Zotero-managed attachment files.
- Preserving any legacy duplicate-name behavior.

## Recommended Approach

Introduce a preparation step between attachment resolution and clipboard payload
building.

Each resolved attachment will continue to track its original source path, but
the copy pipeline will prepare a final clipboard path for the current operation:

- Group attachments by visible file name plus extension.
- If a group contains a single attachment, reuse the original path.
- If a group contains multiple attachments, keep the first attachment's file
  name unchanged and create temporary copies for the remaining attachments.
- Name those temporary copies with an incrementing suffix before the extension:
  `basename_1.ext`, `basename_2.ext`, and so on.

Clipboard payload generation and platform-specific backends will consume the
prepared clipboard paths only. This keeps the platform surface small and avoids
clipboard protocol changes.

## Data Flow

1. Resolve eligible attachments from the Zotero selection or reader context.
2. Prepare clipboard paths for this copy operation.
3. Build clipboard payload from prepared paths.
4. Write the payload through the existing platform backend chain.

The preparation step should create one operation-scoped temporary directory for
all generated copies. A unique directory name should be used per copy request
to avoid collisions across consecutive operations.

## Module Changes

### `src/modules/copy/types.ts`

- Extend `ResolvedAttachment` to distinguish the original attachment path from
  the clipboard path used by the current operation.

### `src/modules/copy/attachmentResolver.ts`

- Keep attachment resolution focused on selecting eligible attachments and
  returning original source paths.

### New clipboard-path preparation module

Add a focused module under `src/modules/copy/` responsible for:

- extracting file name parts
- grouping attachments by visible name plus extension
- generating unique suffixed names
- creating the temporary directory for the operation
- copying conflicting attachments into that directory
- returning attachments with final clipboard paths

This module should be pure where possible, with filesystem effects isolated
behind a narrow dependency interface for testing.

### `src/modules/copy/clipboard/payload.ts`

- Build clipboard payloads from the final clipboard paths rather than original
  source paths.

### `src/modules/copy/clipboardWriter.ts`

- Invoke the preparation module before payload generation.
- Return the usual `copy-no-files` result when preparation yields no clipboard
  paths.

## Error Handling

- If a temporary copy cannot be created for a conflicting attachment, fail the
  copy operation rather than silently dropping or flattening the duplicate.
- If a file name already contains a suffix like `_1`, still append the new
  generated suffix based on the full base name. For example, `paper_1.pdf` may
  produce `paper_1_1.pdf`.
- Duplicate detection should be case-sensitive or case-insensitive according to
  the file name string presented to the current runtime. The implementation
  should choose one rule and test it explicitly. The default recommendation is
  case-sensitive matching, because the user requirement is about identical
  names, not merely similar names.

## Testing

Add unit tests that verify:

- duplicate file names with the same extension produce `name.ext`,
  `name_1.ext`, `name_2.ext`
- different extensions with the same base name do not trigger temporary
  renaming
- clipboard payload generation uses prepared clipboard paths
- clipboard writer sends the renamed temporary paths to the active backend

## Risks

- Temporary file accumulation if operation-scoped directories are never cleaned
  up. The first implementation can tolerate this if cleanup hooks are not
  reliable, but the directory layout should make later cleanup straightforward.
- Filesystem copy behavior may differ across Zotero runtime environments, so the
  filesystem abstraction must be easy to stub in tests.

## Implementation Direction

1. Add a failing unit test for duplicate-name preparation.
2. Implement the preparation module with the smallest dependency surface needed
   for filesystem operations.
3. Add a failing clipboard-writer test proving that renamed temporary paths are
   passed to the backend.
4. Wire the preparation step into `writeClipboard()`.
5. Run unit tests, build, and lint checks.
