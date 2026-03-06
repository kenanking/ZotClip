# ZotClip Settings and Attachment Types Design

## 1. Context and Goal

ZotClip currently exposes a sparse preferences pane and only copies PDF
attachments. The next revision should make the settings pane feel intentional
and readable, allow users to control which attachment types are copyable, and
replace the plugin icon with the provided new artwork.

The goal is to keep the existing copy pipeline intact while generalizing the
resolver from "PDF-only" to "allowed attachment types", and to make the
preferences experience match that broader capability.

## 2. Scope

### In scope

1. Redesign the ZotClip preferences pane layout and copy.
2. Replace PDF-only attachment filtering with user-configurable allowed types.
3. Support built-in type toggles for `PDF`, `EPUB`, `MOBI`, and `TXT`.
4. Support custom attachment extensions entered as a comma-separated list.
5. Apply attachment-type filtering to both selection copy and reader copy.
6. Rename multi-copy wording from PDF-specific to attachment-specific.
7. Replace addon icon assets with the provided new icon.

### Out of scope

1. Backward compatibility with old preference keys.
2. A full attachment-type management UI with reorder/delete rows.
3. Reader-specific multi-attachment behavior.
4. New clipboard transport formats beyond the current pipeline.

## 3. Product Decisions

1. The settings UI keeps Zotero-native controls, but groups them into clearer
   sections with stronger spacing and helper text.
2. The attachment-type configuration uses preset checkboxes plus one custom
   extension input field.
3. The reader always copies only the current attachment, but that attachment
   must still pass the allowed-type filter.
4. The selection flow keeps the existing two-mode strategy:
   - `all`: copy all allowed attachments
   - `primary`: copy only the primary allowed attachment
5. If the user enables no attachment types, the preferences UI blocks saving
   that invalid state instead of silently restoring a default.
6. User-visible copy messages switch from PDF-specific wording to attachment-
   specific wording.

## 4. Information Architecture

The preferences pane is reorganized into three sections:

1. `Copy Scope`
   - `Multi-Attachment Strategy`
2. `Allowed Attachment Types`
   - preset checkboxes: `PDF`, `EPUB`, `MOBI`, `TXT`
   - custom extension input with inline description
   - inline validation message when the effective allowed-type set is empty
3. `Compatibility`
   - `Reader Ctrl+C Behavior`
   - `Allow path-text fallback`

Build metadata remains at the bottom with lower visual weight.

## 5. Preferences Model

The preferences layer moves to attachment-oriented keys with no migration layer:

1. `multiAttachmentMode: "all" | "primary"`
2. `readerCtrlCMode: "smart" | "never" | "always"`
3. `allowPathFallback: boolean`
4. `enabledAttachmentTypes: string`
   - stores comma-separated normalized preset keys, for example `pdf,epub`
5. `customAttachmentTypes: string`
   - stores comma-separated normalized custom extensions, for example
     `azw3,djvu`

At runtime, the effective allowed-extension set is:

`normalize(enabledAttachmentTypes) U normalize(customAttachmentTypes)`

Normalization rules:

1. lowercase all values
2. trim whitespace
3. remove any leading `.`
4. drop empty tokens
5. de-duplicate while preserving stable order

## 6. Attachment Resolution Design

The resolver no longer depends on `isPDFAttachment()`. Instead it resolves file
paths and validates attachments by normalized file extension.

### 6.1 Selection copy

1. If the selected item is an attachment:
   - resolve its file path
   - derive the extension
   - include it only if the extension is allowed
2. If the selected item is a regular item:
   - `all` mode:
     - inspect child attachments
     - resolve paths
     - keep all attachments whose extensions are allowed
   - `primary` mode:
     - inspect best attachment candidates first
     - choose the first allowed attachment among best candidates
     - if no best candidate is allowed, fall back to the first allowed child
       attachment

### 6.2 Reader copy

1. Resolve the current reader attachment by `itemID`.
2. Resolve its file path and extension.
3. Copy only if the extension is in the effective allowed set.
4. Otherwise return a failure result that explains the attachment type is not
   enabled.

### 6.3 Matching rules

1. Matching is case-insensitive.
2. `pdf` and `.pdf` are treated as the same input.
3. Attachments without a usable file path or extension are not copyable.
4. Results are still de-duplicated by final file path.

## 7. UI Interaction Design

The preferences pane should look like a compact settings card instead of a raw
stack of controls.

### 7.1 Layout

1. Use a linked stylesheet for spacing, borders, section headers, and helper
   text.
2. Keep label/control alignment stable for dropdown rows.
3. Render attachment presets as a checkbox grid instead of a dropdown.
4. Show custom-extension helper text directly beneath the input.
5. Show validation feedback inline near the attachment-type controls.

### 7.2 Behavior

1. On load, the script reads stored preset and custom extensions.
2. Preset checkboxes reflect the stored preset set.
3. The custom input renders normalized values joined by `, `.
4. On change or blur, the script re-normalizes the custom input.
5. If the effective allowed set becomes empty, the UI surfaces an error and
   prevents persisting that state.

## 8. Copy Feedback and Errors

Copy result handling keeps the current success/failure shape, with clearer
messages for type filtering:

1. No allowed attachments resolved from selection:
   - `No allowed attachment files found for current selection.`
2. Reader attachment type not enabled:
   - `Current reader attachment type is not enabled for copying.`
3. Fallback success:
   - keep the existing fallback behavior, but describe `attachment path(s)`
     instead of PDF-only wording
4. Success:
   - `Copied X attachment file(s) to clipboard (file-object).`

Clipboard writer behavior and fallback order do not change.

## 9. Localization

The preferences strings need both English and Chinese updates:

1. rename PDF-specific preference labels to attachment-specific labels
2. add labels for each preset attachment type
3. add helper text for custom extensions
4. add validation message text
5. update menu labels where PDF-only wording is now misleading

The Chinese locale should use actual Chinese text rather than duplicating the
English strings.

## 10. Icon Replacement

Replace the current icon family with the provided artwork in:

1. `addon/content/icons/favicon.png`
2. `addon/content/icons/favicon@0.5x.png`
3. repository root `icon.png` for asset consistency

The manifest and preference pane registration already reference the icon paths,
so no manifest schema change is needed.

## 11. Testing Strategy

### 11.1 Unit tests

1. normalize preset and custom extension input
2. compute effective allowed extension set
3. filter selection attachments by allowed type
4. resolve `primary` mode using the first allowed candidate
5. reject reader copy when the current attachment type is disabled
6. format updated notifier messages
7. validate empty attachment-type configuration in the preference script logic

### 11.2 Build verification

1. `npm run test:unit`
2. `npm run build`
3. `npm run lint:check`

### 11.3 Manual verification

1. check the redesigned preferences pane in Zotero
2. copy mixed attachment selections with different allowed-type settings
3. verify reader copy succeeds for enabled types and fails for disabled types
4. confirm the new icon appears in the preference pane and packaged addon

## 12. Acceptance Criteria

1. The preferences pane is visually grouped and easier to scan.
2. Users can enable preset attachment types and add custom extensions.
3. Selection copy only resolves attachments whose extensions are allowed.
4. Reader copy obeys the same allowed-type filter.
5. Multi-copy wording is attachment-oriented rather than PDF-oriented.
6. The new icon is used across addon assets.
