# ZotClip Menu Icon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the existing ZotClip SVG icon to both custom menu entries so the item context menu and Tools menu use the same visual identity.

**Architecture:** Keep the change local to `src/hooks.ts` by defining one shared menu icon URI and passing it into both `ztoolkit.Menu.register(...)` calls. Add a small regression test that scans the source file and confirms both menu registrations include the SVG `icon` property.

**Tech Stack:** TypeScript, Zotero plugin toolkit menu registration, Node test runner

---

### Task 1: Add a regression test for menu icon wiring

**Files:**

- Modify: `spec/unit/icon-assets.test.ts`
- Test: `spec/unit/icon-assets.test.ts`

**Step 1: Write the failing test**

```ts
test("custom menu registrations use the packaged SVG icon", () => {
  const hooks = readFileSync("src/hooks.ts", "utf8");

  assert.match(hooks, /const menuIcon = `chrome:\\/\\/.+content\\/icons\\/favicon\\.svg`;/);
  assert.match(hooks, /ztoolkit\\.Menu\\.register\\("item",[\\s\\S]*?icon: menuIcon,/);
  assert.match(hooks, /ztoolkit\\.Menu\\.register\\("menuTools",[\\s\\S]*?icon: menuIcon,/);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: FAIL because the menu registrations do not include `icon` yet.

**Step 3: Write minimal implementation**

No implementation in this task. This task locks the expected menu icon wiring.

**Step 4: Commit**

```bash
git add spec/unit/icon-assets.test.ts
git commit -m "test: define menu icon registration expectation"
```

### Task 2: Add the SVG icon to both menu entries

**Files:**

- Modify: `src/hooks.ts`
- Modify: `spec/unit/icon-assets.test.ts`
- Test: `spec/unit/icon-assets.test.ts`

**Step 1: Add a shared menu icon constant**

Define:

```ts
const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`;
```

Place it in `src/hooks.ts` near the menu registration code so both menu entries
reuse the same URI.

**Step 2: Add `icon: menuIcon` to both menu registrations**

Update the `"item"` and `"menuTools"` registrations only.

**Step 3: Run the targeted test to verify it passes**

Run: `npm run test:unit -- spec/unit/icon-assets.test.ts`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/hooks.ts spec/unit/icon-assets.test.ts
git commit -m "feat: add ZotClip icon to custom menus"
```

### Task 3: Run full verification

**Files:**

- Check: `src/hooks.ts`
- Check: `spec/unit/icon-assets.test.ts`

**Step 1: Run the full unit test suite**

Run: `npm run test:unit`
Expected: PASS.

**Step 2: Run the build**

Run: `npm run build`
Expected: PASS.

**Step 3: Run lint checks**

Run: `npm run lint:check`
Expected: PASS.

**Step 4: Commit**

```bash
git add src/hooks.ts spec/unit/icon-assets.test.ts
git commit -m "chore: verify menu icon wiring"
```
