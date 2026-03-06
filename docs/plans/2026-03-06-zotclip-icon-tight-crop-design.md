# ZotClip Icon Tight-Crop Design

## 1. Context and Goal

ZotClip now uses a single runtime SVG icon at
`addon/content/icons/favicon.svg`, derived from the root `icon.svg`.

The current icon geometry is visually correct, but the clip mark sits inside a
fairly generous transparent margin. The goal is to enlarge the clip artwork so
it occupies more of the square canvas while still keeping a very thin safety
border.

## 2. Constraints

1. Keep the current ink-blue/green palette unchanged.
2. Keep the existing `viewBox` unchanged.
3. Keep all `path` geometry unchanged.
4. Adjust only the outer `<g transform>` values.
5. Preserve a thin safety border instead of pushing the artwork fully edge to
   edge.

## 3. Recommended Approach

Use transform-only scaling:

1. increase the group scale enough to make the clip noticeably larger
2. rebalance the translate values so the enlarged mark remains visually centered
3. target an effective visual border of roughly `2%` to `4%`

The approved transform for implementation is:

`translate(-219.480899,1065.401298) scale(0.161000,-0.161000)`

This approach is preferred over changing `viewBox` or editing path data because
it preserves the approved geometry and gradient behavior while minimizing
implementation risk.

## 4. Visual Acceptance Criteria

1. The clip fills more of the square icon than it does today.
2. The transparent margin is reduced on all sides.
3. No side appears clipped or pressed against the canvas edge.
4. The margin looks balanced horizontally and vertically.
5. The inner loop still reads cleanly at small icon sizes.

## 5. Runtime Scope

The same transform update should be applied to:

1. `icon.svg`
2. `addon/content/icons/favicon.svg`

No other icon assets should be added, restored, or recolored.

## 6. Verification Strategy

1. Add a unit test that reads both SVG files and asserts their transform has
   been updated to the new, larger values.
2. Confirm both SVG files still parse as valid XML.
3. Run `npm run test:unit`.
4. Run `npm run build`.
5. Run `npm run lint:check`.
