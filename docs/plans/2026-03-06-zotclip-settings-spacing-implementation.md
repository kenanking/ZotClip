# ZotClip Settings Spacing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the custom-extension input feel less tall while keeping it full-width, and increase the gap between `Preset types` and the preset checkbox row.

**Architecture:** Restrict the change to the lightweight settings stylesheet so the current native-style structure and behavior stay untouched. Use minimal CSS adjustments for control height and vertical spacing, then verify build and formatting stay clean.

**Tech Stack:** CSS, XUL/XHTML preferences markup, npm, Zotero plugin scaffold

---

### Task 1: Tighten the custom input height and increase preset spacing

**Files:**
- Modify: `addon/content/preferences.css`

**Step 1: Write the failing test surrogate**

Because this is a CSS-only visual adjustment, use a narrow diff target instead
of an automated visual test:

1. Note the current rules:
   - `.zotclip-pref-type-grid { margin-top: 6px; }`
   - `.zotclip-pref-textinput { min-width: 24rem; width: 100%; }`
2. Target outcome:
   - larger top spacing for `.zotclip-pref-type-grid`
   - reduced visual height for `.zotclip-pref-textinput`

**Step 2: Verify the current state**

Run: `Get-Content addon/content/preferences.css`

Expected: The stylesheet still shows the tighter preset gap and no explicit
height tightening on the text input.

**Step 3: Write minimal implementation**

```css
.zotclip-pref-type-grid {
  margin-top: 10px;
}

.zotclip-pref-textinput {
  min-height: 28px;
  padding-block: 2px;
}
```

Keep the input full-width.

**Step 4: Verify the resulting CSS**

Run: `Get-Content addon/content/preferences.css`

Expected: The input remains full-width, the control height is reduced, and the
preset row starts lower than before.

**Step 5: Commit**

```bash
git add addon/content/preferences.css
git commit -m "style: refine settings input spacing"
```

### Task 2: Verify build and formatting

**Files:**
- Verify only

**Step 1: Run the build**

Run: `npm run build`

Expected: PASS

**Step 2: Run lint checks**

Run: `npm run lint:check`

Expected: PASS

**Step 3: Manual Zotero check**

Run: `npm run start`

Check:

1. The `Custom extensions` input still spans the row.
2. The input no longer feels taller than Zotero's default controls.
3. The `Preset types` label has more breathing room above the checkbox row.

**Step 4: Commit**

```bash
git add .
git commit -m "style: polish settings field spacing"
```
