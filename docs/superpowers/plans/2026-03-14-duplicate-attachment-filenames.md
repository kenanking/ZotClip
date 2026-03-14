# Duplicate Attachment Filenames Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure a single copy operation produces unique clipboard file names for attachments that share the same visible file name and extension.

**Architecture:** Add a focused attachment-preparation step inside the copy pipeline that converts conflicting attachments into uniquely named temporary copies before clipboard payload generation. Keep attachment resolution responsible for discovering original files, keep clipboard backends unchanged, and isolate filesystem effects behind a small dependency surface for targeted unit tests.

**Tech Stack:** TypeScript, Node test runner via `tsx --test`, Zotero/XPCOM runtime helpers, existing clipboard writer/backends

---

## File Structure

- Create: `src/modules/copy/preparedAttachments.ts`
  - Owns duplicate-name detection, suffix generation, and temporary-copy preparation.
- Modify: `src/modules/copy/types.ts`
  - Extend `ResolvedAttachment` to carry the original `path` plus an optional `clipboardPath`.
- Modify: `src/modules/copy/clipboard/payload.ts`
  - Serialize prepared clipboard paths instead of original paths.
- Modify: `src/modules/copy/clipboardWriter.ts`
  - Invoke attachment preparation before payload generation and backend execution.
- Create: `spec/unit/prepared-attachments.test.ts`
  - Covers duplicate-name preparation rules and filesystem interactions.
- Modify: `spec/unit/clipboard-payload.test.ts`
  - Verifies payload generation prefers prepared clipboard paths.
- Modify: `spec/unit/clipboard-writer.test.ts`
  - Verifies writer passes renamed temporary paths to the active backend.

## Chunk 1: Prepare Unique Clipboard Paths

### Task 1: Add preparation tests and the minimal data shape

**Files:**

- Create: `spec/unit/prepared-attachments.test.ts`
- Modify: `src/modules/copy/types.ts`
- Test: `spec/unit/prepared-attachments.test.ts`

- [ ] **Step 1: Write the failing preparation tests**

```ts
test("prepareResolvedAttachments keeps the first duplicate name and suffixes later duplicates", async () => {
  const prepared = await prepareResolvedAttachments(
    [
      { itemID: 1, attachmentID: 11, path: "/src/a/paper.pdf" },
      { itemID: 1, attachmentID: 12, path: "/src/b/paper.pdf" },
      { itemID: 1, attachmentID: 13, path: "/src/c/paper.pdf" },
    ],
    deps,
  );

  assert.deepEqual(
    prepared.map((file) => file.clipboardPath),
    [
      "/src/a/paper.pdf",
      "/tmp/zotclip-op/paper_1.pdf",
      "/tmp/zotclip-op/paper_2.pdf",
    ],
  );
});

test("prepareResolvedAttachments ignores duplicates when extensions differ", async () => {
  const prepared = await prepareResolvedAttachments(
    [
      { itemID: 1, attachmentID: 21, path: "/src/a/paper.pdf" },
      { itemID: 1, attachmentID: 22, path: "/src/b/paper.epub" },
    ],
    deps,
  );

  assert.deepEqual(
    prepared.map((file) => file.clipboardPath),
    ["/src/a/paper.pdf", "/src/b/paper.epub"],
  );
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx tsx --test spec/unit/prepared-attachments.test.ts`
Expected: FAIL because `prepareResolvedAttachments` and `clipboardPath` handling do not exist yet.

- [ ] **Step 3: Extend the resolved attachment shape**

```ts
export interface ResolvedAttachment {
  itemID: number;
  attachmentID: number;
  path: string;
  clipboardPath?: string;
}
```

Keep attachment resolution returning `path` only. Do not set
`clipboardPath` there.

- [ ] **Step 4: Run the existing attachment resolver tests**

Run: `npx tsx --test spec/unit/attachment-resolver.test.ts`
Expected: PASS, because resolver output should remain backward-compatible inside this branch.

- [ ] **Step 5: Re-run the preparation test after the shape update**

Run: `npx tsx --test spec/unit/prepared-attachments.test.ts`
Expected: FAIL because the preparation module still does not exist.

- [ ] **Step 6: Re-run the resolver tests**

Run: `npx tsx --test spec/unit/attachment-resolver.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit the data-shape update**

```bash
git add src/modules/copy/types.ts spec/unit/prepared-attachments.test.ts
git commit -m "refactor: add prepared clipboard paths to attachments"
```

### Task 2: Implement duplicate-name preparation

**Files:**

- Create: `src/modules/copy/preparedAttachments.ts`
- Test: `spec/unit/prepared-attachments.test.ts`

- [ ] **Step 1: Write the failing filesystem-interaction test**

```ts
test("prepareResolvedAttachments copies duplicate files into an operation temp directory", async () => {
  const copied: Array<{ from: string; to: string }> = [];

  await prepareResolvedAttachments(duplicateInputs, {
    createOperationTempDir: async () => "/tmp/zotclip-op",
    copyFile: async (from, to) => copied.push({ from, to }),
    getBaseName: (path) => path.split("/").pop() || "",
    joinPath: (...parts) => parts.join("/"),
  });

  assert.deepEqual(copied, [
    { from: "/src/b/paper.pdf", to: "/tmp/zotclip-op/paper_1.pdf" },
    { from: "/src/c/paper.pdf", to: "/tmp/zotclip-op/paper_2.pdf" },
  ]);
});
```

- [ ] **Step 2: Run the preparation tests to verify they fail**

Run: `npx tsx --test spec/unit/prepared-attachments.test.ts`
Expected: FAIL because the module does not exist yet.

- [ ] **Step 3: Implement the smallest preparation module**

```ts
export async function prepareResolvedAttachments(
  files: ResolvedAttachment[],
  deps: PreparedAttachmentDeps = DEFAULT_DEPS,
): Promise<ResolvedAttachment[]> {
  const groups = groupByVisibleName(files, deps);
  const tempDir = needsTempDir(groups)
    ? await deps.createOperationTempDir()
    : undefined;

  return prepareGroups(groups, tempDir, deps);
}
```

Implementation requirements:

- group by full visible file name, including extension
- keep the first file in each duplicate group unchanged
- copy later duplicates into the operation temp directory with `_1`, `_2`, ...
- set `clipboardPath` for every returned attachment

- [ ] **Step 4: Run the preparation tests to verify they pass**

Run: `npx tsx --test spec/unit/prepared-attachments.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the preparation module**

```bash
git add src/modules/copy/preparedAttachments.ts spec/unit/prepared-attachments.test.ts
git commit -m "feat: prepare unique clipboard filenames"
```

## Chunk 2: Wire Prepared Paths Into Clipboard Writing

### Task 3: Make payload generation prefer clipboard paths

**Files:**

- Modify: `spec/unit/clipboard-payload.test.ts`
- Modify: `src/modules/copy/clipboard/payload.ts`
- Test: `spec/unit/clipboard-payload.test.ts`

- [ ] **Step 1: Write the failing payload test**

```ts
test("buildClipboardPayload prefers clipboardPath over path", () => {
  const payload = buildClipboardPayload(
    [
      {
        itemID: 1,
        attachmentID: 11,
        path: "/src/a/paper.pdf",
        clipboardPath: "/tmp/zotclip-op/paper.pdf",
      },
    ],
    "library",
  );

  assert.deepEqual(payload.paths, ["/tmp/zotclip-op/paper.pdf"]);
});
```

- [ ] **Step 2: Run the payload test to verify it fails**

Run: `npx tsx --test spec/unit/clipboard-payload.test.ts`
Expected: FAIL because `buildClipboardPayload()` still reads `path`.

- [ ] **Step 3: Update payload generation minimally**

```ts
const paths = Array.from(
  new Set(
    files
      .map((file) => (file.clipboardPath || file.path).trim())
      .filter(Boolean),
  ),
);
```

- [ ] **Step 4: Run the payload test to verify it passes**

Run: `npx tsx --test spec/unit/clipboard-payload.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the payload update**

```bash
git add src/modules/copy/clipboard/payload.ts spec/unit/clipboard-payload.test.ts
git commit -m "refactor: build clipboard payloads from prepared paths"
```

### Task 4: Prepare attachments inside the clipboard writer

**Files:**

- Modify: `src/modules/copy/clipboardWriter.ts`
- Modify: `spec/unit/clipboard-writer.test.ts`
- Test: `spec/unit/clipboard-writer.test.ts`

- [ ] **Step 1: Write the failing writer integration test**

```ts
test("ClipboardWriter writes renamed temporary paths when duplicate filenames exist", async () => {
  let writtenPaths: string[] | undefined;

  const result = await writeClipboard(
    [
      { attachmentID: 1, itemID: 1, path: "/src/a/paper.pdf" },
      { attachmentID: 2, itemID: 1, path: "/src/b/paper.pdf" },
    ],
    "library",
    {
      detectPlatformContext: () => ({ platform: "windows" }),
      prepareResolvedAttachments: async () => [
        {
          attachmentID: 1,
          itemID: 1,
          path: "/src/a/paper.pdf",
          clipboardPath: "/src/a/paper.pdf",
        },
        {
          attachmentID: 2,
          itemID: 1,
          path: "/src/b/paper.pdf",
          clipboardPath: "/tmp/zotclip-op/paper_1.pdf",
        },
      ],
      writeWindowsFileDrop: async (paths) => {
        writtenPaths = paths;
        return true;
      },
      writePathText: () => false,
    },
  );

  assert.deepEqual(writtenPaths, [
    "/src/a/paper.pdf",
    "/tmp/zotclip-op/paper_1.pdf",
  ]);
  assert.equal(result.ok, true);
});
```

- [ ] **Step 2: Run the writer test to verify it fails**

Run: `npx tsx --test spec/unit/clipboard-writer.test.ts`
Expected: FAIL because `writeClipboard()` has no preparation hook.

- [ ] **Step 3: Add the preparation dependency and wire it in**

```ts
const preparedFiles = (await deps.prepareResolvedAttachments?.(files)) ?? files;
const payload = buildClipboardPayload(preparedFiles, source);
```

Use the real `prepareResolvedAttachments()` implementation in default deps.
Keep the existing `copy-no-files` behavior based on the prepared payload.

- [ ] **Step 4: Run the writer test to verify it passes**

Run: `npx tsx --test spec/unit/clipboard-writer.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the focused copy test suite**

Run: `npx tsx --test spec/unit/attachment-resolver.test.ts spec/unit/prepared-attachments.test.ts spec/unit/clipboard-payload.test.ts spec/unit/clipboard-writer.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit the clipboard-writer integration**

```bash
git add src/modules/copy/clipboardWriter.ts spec/unit/clipboard-writer.test.ts src/modules/copy/clipboard/payload.ts
git commit -m "feat: avoid duplicate attachment filename conflicts"
```

## Chunk 3: Full Verification

### Task 5: Run repository verification and update manual checks if needed

**Files:**

- Modify if needed: `docs/manual-testing.md`

- [ ] **Step 1: Review manual coverage**

If the current checklist does not mention duplicate-name copy conflicts, add one
short verification item under the library copy or multi-attachment section.

- [ ] **Step 2: Run unit tests**

Run: `npm run test:unit`
Expected: PASS with 0 failures.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS with exit code 0.

- [ ] **Step 4: Run lint**

Run: `npm run lint:check`
Expected: PASS with no Prettier or ESLint errors.

- [ ] **Step 5: Commit verification/docs follow-up**

```bash
git add docs/manual-testing.md
git commit -m "docs: cover duplicate attachment filename copy checks"
```
