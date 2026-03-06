# ZotClip Settings Typography Design

## 1. Goal

Adjust the current ZotClip settings page typography so only the top-level
section headings remain visually emphasized, while field labels and dropdown
text return to a normal weight closer to Zotero's native preferences pages.

## 2. Scope

### In scope

1. Keep the section titles visually emphasized:
   - `复制范围`
   - `可复制的附件类型`
   - `兼容性`
2. Change field-level labels to normal weight:
   - `多附件策略`
   - `预设类型`
   - `自定义扩展名`
   - `阅读器 Ctrl+C 行为`
3. Ensure dropdown text also renders at normal weight.

### Out of scope

1. Changes to settings-page structure.
2. Changes to spacing, input sizes, or logic.
3. Changes to localization strings.

## 3. Design Decisions

1. Limit the change to the lightweight stylesheet at
   `addon/content/preferences.css`.
2. Remove the explicit heavier weight from `.zotclip-pref-field-label`.
3. Add explicit normal-weight styling to `.zotclip-pref-menulist` so the
   closed-state value does not read like a heading.
4. Leave section heading styling untouched.

## 4. Expected Result

1. Section titles still define the page hierarchy clearly.
2. Field labels no longer compete with section titles.
3. Dropdowns visually align with Zotero's built-in preferences controls.

## 5. Verification

1. `npm run build`
2. `npm run lint:check`
3. Manual preference-pane check in Zotero for the final text hierarchy
