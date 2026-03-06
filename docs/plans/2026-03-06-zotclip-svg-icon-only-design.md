# ZotClip SVG-Only Icon Migration Design

## 1. Context and Goal

ZotClip currently uses raster icon assets in the addon package:

1. `addon/content/icons/favicon.png`
2. `addon/content/icons/favicon@0.5x.png`

Those PNGs are referenced from three runtime entry points:

1. `addon/manifest.json`
2. `src/hooks.ts` via `Zotero.PreferencePanes.register({ image })`
3. `src/utils/ztoolkit.ts` via `ProgressWindow.setIconURI()`

The goal is to remove the PNG runtime icon pipeline entirely and migrate the
addon to a single SVG icon source.

## 2. Constraints

1. Keep only SVG for runtime icon usage.
2. Do not preserve PNG fallback assets.
3. Do not change the icon geometry or selected ink-green palette.
4. Keep root-level alternate SVG files as design assets only, not runtime
   assets.

## 3. Approved Direction

Adopt one canonical runtime icon:

1. `addon/content/icons/favicon.svg`

All runtime references should point to that file, including manifest icons,
preference pane icon, and progress window icon.

The root-level `icon.svg` remains the design master. Runtime packaging should
use a copy of that artwork under `addon/content/icons/favicon.svg`.

## 4. Scope

### In scope

1. Create `addon/content/icons/favicon.svg`.
2. Update `addon/manifest.json` icon paths from PNG to SVG.
3. Update `src/hooks.ts` preference pane icon URI from PNG to SVG.
4. Update `src/utils/ztoolkit.ts` progress window icon URI from PNG to SVG.
5. Delete `addon/content/icons/favicon.png`.
6. Delete `addon/content/icons/favicon@0.5x.png`.
7. Add a targeted regression test that asserts runtime icon references use SVG
   and PNG references are gone.

### Out of scope

1. Preserving PNG compatibility assets.
2. Changing icon color, geometry, or alternate variants.
3. Adding dynamic icon selection logic.

## 5. Risk Assessment

The main risk is runtime SVG rendering consistency in Zotero UI surfaces. Since
the user explicitly wants no PNG fallback, verification must focus on the real
icon entry points rather than compatibility branching.

## 6. Verification Strategy

1. Assert manifest icon entries point to `content/icons/favicon.svg`.
2. Assert source code no longer references `favicon.png`.
3. Confirm `addon/content/icons/favicon.svg` exists and parses as valid XML.
4. Confirm both PNG files are removed.
5. Run `npm run test:unit`.
6. Run `npm run build`.
7. Run `npm run lint:check`.

## 7. Acceptance Criteria

1. Runtime icon usage is SVG-only.
2. No addon PNG icon assets remain in the repository.
3. All three runtime reference points use the same SVG file.
4. Unit tests, build, and lint checks pass after the migration.
