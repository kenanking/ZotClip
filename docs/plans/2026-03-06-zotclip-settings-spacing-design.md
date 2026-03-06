# ZotClip Settings Spacing Design

## 1. Goal

Tune the current ZotClip settings page so the custom-extension input feels
closer to Zotero's native preferences controls, while slightly increasing the
spacing between the `Preset types` label and its checkbox row.

## 2. Scope

### In scope

1. Keep the `Custom extensions` input full-width.
2. Reduce the apparent height of that input.
3. Increase the vertical spacing between `Preset types` and the preset
   checkbox row.
4. Preserve the current native-style page structure.

### Out of scope

1. Any changes to settings-page markup structure.
2. Any changes to preference script or copy logic.
3. Any broader restyling of the settings page.

## 3. Design Decisions

1. Adjust only `addon/content/preferences.css`.
2. Reduce the custom input height by tightening its control height and vertical
   padding rather than shrinking the width.
3. Increase only the top spacing before the preset checkbox row so the section
   breathes more like Zotero's built-in preferences pages.
4. Leave menulist widths, typography, and other section spacing unchanged.

## 4. Expected Result

1. The `Custom extensions` input still spans the row but no longer feels
   oversized vertically.
2. The `Preset types` label and the checkbox row below it are less cramped.
3. The page remains visually consistent with the current native-style
   refinement.

## 5. Verification

1. `npm run build`
2. `npm run lint:check`
3. Manual preference-pane check in Zotero for the final visual balance
