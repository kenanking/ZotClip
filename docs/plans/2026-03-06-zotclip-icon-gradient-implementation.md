# ZotClip Icon Gradient Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the ZotClip icon family with the approved ink-blue and green gradient treatment and preserve alternate SVG palettes for later use.

**Architecture:** Keep the current clip path geometry intact, add SVG `linearGradient` definitions for the outer loop and inner arcs, and export the primary gradient variant to the addon PNG files already referenced by the manifest. This is an asset-only change, so verification relies on SVG/XML validation, raster export success, and a fresh project build rather than unit tests.

**Tech Stack:** SVG, PowerShell, Zotero addon asset paths

---

### Task 1: Author the SVG variants

**Files:**

- Modify: `icon.svg`
- Create: `icon-alt-ice-blue.svg`
- Create: `icon-alt-ink-green.svg`

**Step 1: Define the approved palette mapping**

Set these gradients:

- primary outer loop: `#0B4C8C -> #1178AE`
- primary inner arcs: `#1D8C88 -> #35C6A2`
- deep sea backup outer loop: `#0D5EA8 -> #18B6A4`
- deep sea backup inner arcs: `#1C8FD0 -> #46D2BD`
- ice backup outer loop: `#1B7FE7 -> #6CE2E0`
- ice backup inner arcs: `#46C9FF -> #A1F0E4`

**Step 2: Apply gradients to the existing path structure**

Use one gradient for the outer path and one gradient for both inner paths in
each SVG. Keep a consistent top-left to bottom-right direction across all
variants.

**Step 3: Validate the SVG files**

Run:

```powershell
$files = @('icon.svg', 'icon-alt-ice-blue.svg', 'icon-alt-ink-green.svg')
foreach ($file in $files) { [xml](Get-Content -Raw $file) | Out-Null }
```

Expected: all three SVG files parse without error.

### Task 2: Export the addon PNG icons from the primary SVG

**Files:**

- Modify: `addon/content/icons/favicon.png`
- Modify: `addon/content/icons/favicon@0.5x.png`

**Step 1: Rasterize the primary SVG**

Export:

- `addon/content/icons/favicon.png` at `96x96`
- `addon/content/icons/favicon@0.5x.png` at `48x48`

**Step 2: Verify the outputs exist at the expected sizes**

Run:

```powershell
Add-Type -AssemblyName System.Drawing
$targets = @(
  'addon/content/icons/favicon.png',
  'addon/content/icons/favicon@0.5x.png'
)
foreach ($target in $targets) {
  $img = [System.Drawing.Image]::FromFile((Resolve-Path $target))
  Write-Output "$target $($img.Width)x$($img.Height)"
  $img.Dispose()
}
```

Expected:

- `addon/content/icons/favicon.png 96x96`
- `addon/content/icons/favicon@0.5x.png 48x48`

### Task 3: Verify project integration

**Files:**

- Check: `addon/manifest.json`

**Step 1: Confirm manifest icon paths remain unchanged**

Run:

```powershell
Get-Content addon\manifest.json
```

Expected: the manifest still references `content/icons/favicon@0.5x.png` and
`content/icons/favicon.png`.

**Step 2: Run build verification**

Run:

```bash
npm run build
```

Expected: build completes successfully.
