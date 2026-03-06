# ZotClip Settings Typography Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore a clearer typography hierarchy in the settings page by keeping only top-level section titles emphasized and rendering field labels and dropdown text at normal weight.

**Architecture:** Restrict the change to `addon/content/preferences.css` so the current settings markup, localization, and behavior remain untouched. Use the smallest possible CSS adjustments to remove explicit bold styling from field labels and ensure menulist text also renders at normal weight.

**Tech Stack:** CSS, XUL/XHTML preferences markup, npm, Zotero plugin scaffold

---

### Task 1: Normalize field-label and dropdown font weight

**Files:**
- Modify: `addon/content/preferences.css`

**Step 1: Write the failing test surrogate**

Because this is a CSS-only typography adjustment, use a narrow diff target
instead of an automated visual test:

1. Note the current rule:
   - `.zotclip-pref-field-label { font-weight: 600; }`
2. Target outcome:
   - field labels render at normal weight
   - menulist text is also constrained to normal weight

**Step 2: Verify the current state**

Run: `Get-Content addon/content/preferences.css`

Expected: The stylesheet still applies `font-weight: 600` to
`.zotclip-pref-field-label` and has no explicit normal-weight override for
`.zotclip-pref-menulist`.

**Step 3: Write minimal implementation**

```css
.zotclip-pref-field-label {
  font-weight: 400;
}

.zotclip-pref-menulist {
  font-weight: 400;
}
```

Leave section headings unchanged.

**Step 4: Verify the resulting CSS**

Run: `Get-Content addon/content/preferences.css`

Expected: Section headings remain untouched, field labels are no longer bold,
and dropdown text has an explicit normal-weight rule.

**Step 5: Commit**

```bash
git add addon/content/preferences.css
git commit -m "style: refine settings typography hierarchy"
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

1. Section headings remain visually emphasized.
2. Field labels are no longer bold.
3. Dropdown text looks like a normal field value rather than a heading.

**Step 4: Commit**

```bash
git add .
git commit -m "style: polish settings typography"
```
