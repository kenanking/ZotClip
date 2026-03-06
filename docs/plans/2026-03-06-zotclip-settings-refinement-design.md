# ZotClip Settings Refinement Design

## 1. Goal

Refine the ZotClip settings pane so it remains close to Zotero's native
preferences style while fixing the remaining dropdown display bug, improving
field spacing and hierarchy, and simplifying the compatibility section.

## 2. Problems Observed

1. The `menulist` controls render with an empty closed state even though menu
   items exist and the preference values are set.
2. The `Allowed Attachment Types` group feels cramped, especially around preset
   checkboxes and the custom-extension field.
3. `Preset types` and `Custom extensions` do not look like the same hierarchy
   level because one is rendered as muted help text and the other as a normal
   field label.
4. `Allow path-text fallback when file clipboard fails` is exposed as a setting
   but reads like unexplained internal behavior.
5. Current fallback notifications describe the path-text copy as a success,
   while the user expectation is to surface the primary file-copy failure.

## 3. Root Cause Notes

1. The dropdown issue is not caused by narrow control width.
2. The closed `menulist` label depends on menu item labels, not only on the
   stored `value`.
3. Firefox/XUL examples in Searchfox show localized dropdown items using
   Fluent attributes such as `.label`, which aligns with the missing visible
   label in the current implementation.
4. The attachment-type group inconsistency comes from mixing `<description>`
   styling for one field header with `<html:label>` styling for another.

## 4. Scope

### In scope

1. Fix both dropdowns so the selected option text is shown on load and after
   selection.
2. Add a minimal native-compatible stylesheet for spacing, alignment, and
   sensible control widths.
3. Make `Preset types` and `Custom extensions` visually consistent.
4. Remove the path-fallback setting from the preferences UI.
5. Keep path fallback as a fixed runtime behavior.
6. Change fallback notifications so they communicate a file-copy failure with
   a path-text fallback, instead of presenting that outcome as plain success.

### Out of scope

1. Reintroducing the previous card-style settings layout.
2. Changing attachment-resolution rules.
3. Adding new settings unrelated to these issues.

## 5. Design Decisions

1. Keep the native `groupbox`-based page structure.
2. Reintroduce a very small stylesheet only for:
   - vertical spacing between sections and fields
   - spacing between preset checkboxes
   - consistent label appearance for field headers
   - minimum widths for dropdowns and the custom-extension input
3. Define dropdown-item localization using Fluent label attributes so XUL
   controls can render the closed-state text correctly.
4. Preserve the existing preference keys for dropdowns and attachment types.
5. Remove the `allowPathFallback` preference from the settings page and treat
   path fallback as always enabled in the copy pipeline.
6. Extend clipboard result metadata so the notifier can distinguish:
   - file copy success
   - file copy failed but path fallback succeeded
   - total failure

## 6. UX Details

### 6.1 Settings Layout

1. `Copy Scope`
   - `Multi-Attachment Strategy`
2. `Allowed Attachment Types`
   - `Preset types`
   - preset checkboxes
   - `Custom extensions`
   - text input
   - helper text
   - validation message
3. `Compatibility`
   - `Reader Ctrl+C Behavior`
   - short note explaining target-app clipboard support variance

### 6.2 Fallback Behavior

1. If file-object clipboard write succeeds, show a normal success message.
2. If file-object clipboard write fails but path fallback succeeds, show a
   failure-oriented message that explicitly states a path-text fallback was
   used.
3. If all clipboard strategies fail, keep the existing failure path.

## 7. Files Expected To Change

1. `addon/content/preferences.xhtml`
2. `addon/content/preferences.css`
3. `addon/locale/zh-CN/preferences.ftl`
4. `addon/locale/en-US/preferences.ftl`
5. `src/modules/preferenceScript.ts`
6. `src/modules/copy/types.ts`
7. `src/modules/copy/clipboardWriter.ts`
8. `src/modules/copy/notifier.ts`
9. `src/modules/copy/copyCommands.ts`
10. `src/utils/prefs.ts`
11. Related unit tests in `spec/unit/`

## 8. Verification

1. `npm run test:unit`
2. `npm run build`
3. `npm run lint:check`
4. Manual checks in Zotero:
   - dropdown text shows immediately
   - attachment-type group spacing is improved
   - `Preset types` and `Custom extensions` have consistent visual weight
   - path-fallback setting is no longer shown
   - fallback notification states file copy failed and path text was used
