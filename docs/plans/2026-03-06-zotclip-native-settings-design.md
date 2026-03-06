# ZotClip Native Settings Design

## 1. Goal

Adjust the ZotClip settings pane so it matches Zotero's native preferences
style, fix the menulist display regression, and reset the addon version to
`0.0.1` for an in-development release.

## 2. Scope

### In scope

1. Remove the card-style visual treatment from the settings pane.
2. Restore a native-looking preference layout using Zotero/XUL controls.
3. Keep the attachment-type controls added in the recent redesign.
4. Fix the `Multi-Attachment Strategy` menulist so its current label is shown
   on load and after selection.
5. Keep the `Reader Ctrl+C Behavior` menulist working the same way.
6. Change the displayed build version from `3.1.0` to `0.0.1`.

### Out of scope

1. Changes to attachment copy resolution or clipboard behavior.
2. Preference key migrations.
3. A new custom design system for preferences.

## 3. Design Decisions

1. Revert the preferences pane structure to a mostly native `groupbox`-based
   layout instead of custom card containers.
2. Remove the custom stylesheet entirely unless a minimal spacing override is
   required to keep the attachment-type controls readable.
3. Keep the three logical sections:
   - copy scope
   - allowed attachment types
   - compatibility
4. Present preset attachment types as plain checkboxes, followed by a plain
   text input for custom extensions and small helper text beneath it.
5. Explicitly synchronize menulist selected values during preference pane load
   so the visible label always matches the stored preference value.
6. Update the package version in `package.json`, allowing the existing build
   substitution pipeline to flow that value into the manifest and bottom help
   text automatically.

## 4. UX Details

### 4.1 Layout

1. The page title remains at the top.
2. Each section uses simple native grouping instead of bordered cards.
3. Labels and controls stay horizontally aligned for dropdown rows.
4. Attachment-type controls are vertically stacked and compact.
5. Build metadata remains at the bottom with low visual weight.

### 4.2 Behavior

1. The menulists must show the current preference immediately when the pane
   opens.
2. Selecting a menu item must update the visible menulist label immediately.
3. Attachment-type validation remains unchanged:
   - at least one preset or custom extension must remain enabled
4. Custom extension input continues to normalize values on persistence.

## 5. Files Expected To Change

1. `addon/content/preferences.xhtml`
2. `addon/content/preferences.css` or delete if no longer needed
3. `src/modules/preferenceScript.ts`
4. `spec/unit/preference-script.test.ts`
5. `package.json`

## 6. Verification

1. `npm run test:unit`
2. `npm run build`
3. `npm run lint:check`
4. Manual checks in Zotero:
   - no card-style containers
   - simpler native-looking typography
   - both menulists show current values
   - version text shows `0.0.1`
