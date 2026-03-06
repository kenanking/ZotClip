# ZotClip Icon Gradient Design

## 1. Context and Goal

ZotClip currently has a monochrome clip icon in the repository root as
`icon.svg`, while the addon runtime uses rasterized icon assets at
`addon/content/icons/favicon.png` and `addon/content/icons/favicon@0.5x.png`.

The goal is to keep the existing clip geometry but replace the black fill with
a cleaner, more professional blue-green treatment that still reads clearly on
both light and dark backgrounds. The approved direction should become the
primary icon, while two additional palette variants should remain in the
repository as fallback options.

## 2. Constraints

1. Preserve the existing clip silhouette and path geometry.
2. Support both light and dark UI backgrounds without relying on an outer glow
   or background-colored outline.
3. Keep the result professional and technical rather than playful or neon.
4. Preserve alternates as standalone SVG files for future iteration.

## 3. Shape Model

The source icon contains three filled paths:

1. one large outer loop
2. one inner loop arc
3. one second inner loop arc

The two inner paths visually form a single smaller loop. They should therefore
share the same gradient direction and a slightly brighter tonal range than the
outer loop so the inner structure reads as one unit.

## 4. Palette Options

### Option 1: Deep Sea Blue to Teal

Backup palette after final review.

- Outer loop: `#0D5EA8 -> #18B6A4`
- Inner loop arcs: `#1C8FD0 -> #46D2BD`

Why it works:

1. the darker blue anchors the silhouette on light surfaces
2. the brighter teal-cyan tones keep internal detail visible on dark surfaces
3. the contrast between outer and inner loops adds depth without extra strokes

### Option 2: Ice Blue Gradient

Backup palette for a brighter, more luminous look.

- Outer loop: `#1B7FE7 -> #6CE2E0`
- Inner loop arcs: `#46C9FF -> #A1F0E4`

Trade-off:

This feels more obviously "tech", but the outer shape becomes lighter and less
grounded on pale backgrounds.

### Option 3: Ink Blue and Green Duo

Selected as the final primary palette after review.

- Outer loop: `#0B4C8C -> #1178AE`
- Inner loop arcs: `#1D8C88 -> #35C6A2`

Trade-off:

This keeps excellent small-size legibility, but it has less premium energy
than the recommended option.

## 5. Approved Direction

Use Option 3 as the default icon in `icon.svg` and as the source for the addon
PNG assets.

Store the backup variants as:

1. `icon-alt-deep-sea.svg`
2. `icon-alt-ice-blue.svg`
3. `icon-alt-ink-green.svg`

## 6. Asset Outputs

1. Update `icon.svg` with gradient fills and per-path color hierarchy.
2. Create `icon-alt-ice-blue.svg` for Option 2.
3. Create `icon-alt-ink-green.svg` for Option 3.
4. Export the primary icon to:
   - `addon/content/icons/favicon.png` at 96x96
   - `addon/content/icons/favicon@0.5x.png` at 48x48

## 7. Verification

1. Parse each SVG as XML to confirm it is structurally valid.
2. Confirm `addon/manifest.json` still points to the existing PNG filenames.
3. Run `npm run build` to ensure the asset refresh did not disturb the project
   build.
