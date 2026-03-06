# ZotClip Menu Icon Design

## 1. Context and Goal

ZotClip already uses `addon/content/icons/favicon.svg` for the packaged addon
icon, the preferences pane icon, and the progress window icon.

However, the plugin's custom menu entries currently render without an icon:

1. the item context menu entry for copying attachment files
2. the Tools menu entry for copying the current reader attachment

The goal is to attach the same SVG icon to both menu entries so the plugin has
consistent visual identification across UI entry points.

## 2. Constraints

1. Reuse the existing `favicon.svg`; do not create a separate menu icon asset.
2. Keep the current menu labels and command behavior unchanged.
3. Keep the implementation limited to menu registration.
4. Add regression coverage so the menu icon wiring is not lost later.

## 3. Approved Direction

Define one shared `menuIcon` URI inside `src/hooks.ts` and reuse it in both
`ztoolkit.Menu.register(...)` calls.

The URI should point to:

`chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`

## 4. Runtime Scope

Apply the menu icon only to:

1. the item popup entry registered under `"item"`
2. the Tools menu entry registered under `"menuTools"`

No other menu items or commands are in scope.

## 5. Verification Strategy

1. Add a unit test that reads `src/hooks.ts` and confirms both menu
   registrations include the SVG `icon` field.
2. Run `npm run test:unit`.
3. Run `npm run build`.
4. Run `npm run lint:check`.

## 6. Acceptance Criteria

1. Both custom menu registrations explicitly include the same SVG icon URI.
2. No behavior change is introduced beyond the icon metadata.
3. Unit tests, build, and lint checks all pass.
