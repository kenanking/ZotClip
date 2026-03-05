import assert from "node:assert/strict";
import test from "node:test";

import { resolvePDFsFromItems } from "../../src/modules/copy/attachmentResolver";

function makeAttachment(
  id: number,
  path: string | false,
  options: { isPDF?: boolean; parentID?: number } = {},
) {
  return {
    id,
    parentID: options.parentID,
    isAttachment: () => true,
    isPDFAttachment: () => options.isPDF ?? true,
    getFilePathAsync: async () => path,
  } as unknown as Zotero.Item;
}

function makeRegular(
  id: number,
  childIDs: number[],
  options: { bestMany?: Zotero.Item[]; bestOne?: Zotero.Item | false } = {},
) {
  return {
    id,
    isAttachment: () => false,
    getAttachments: () => childIDs,
    getBestAttachments: async () => options.bestMany ?? [],
    getBestAttachment: async () => options.bestOne ?? false,
  } as unknown as Zotero.Item;
}

test("AttachmentResolver: collects all PDF children in all mode", async () => {
  const a1 = makeAttachment(11, "C:/papers/a.pdf", { parentID: 1 });
  const a2 = makeAttachment(12, "C:/papers/b.pdf", { parentID: 1 });
  const a3 = makeAttachment(13, "C:/papers/not-pdf.epub", {
    isPDF: false,
    parentID: 1,
  });
  const regular = makeRegular(1, [11, 12, 13]);

  const resolved = await resolvePDFsFromItems([regular], "all", {
    getItemsByIDs: () => [a1, a2, a3],
  });

  assert.equal(resolved.length, 2);
  assert.deepEqual(
    resolved.map((r) => r.path),
    ["C:/papers/a.pdf", "C:/papers/b.pdf"],
  );
});

test("AttachmentResolver: uses best attachment in primary mode", async () => {
  const best = makeAttachment(21, "C:/papers/primary.pdf", { parentID: 2 });
  const secondary = makeAttachment(22, "C:/papers/secondary.pdf", {
    parentID: 2,
  });
  const regular = makeRegular(2, [21, 22], {
    bestMany: [best],
    bestOne: secondary,
  });

  const resolved = await resolvePDFsFromItems([regular], "primary", {
    getItemsByIDs: () => {
      throw new Error("all-mode child lookup should not be called");
    },
  });

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].attachmentID, 21);
  assert.equal(resolved[0].path, "C:/papers/primary.pdf");
});

test("AttachmentResolver: accepts selected PDF attachment directly", async () => {
  const attachment = makeAttachment(30, "C:/papers/direct.pdf", {
    parentID: 3,
  });

  const resolved = await resolvePDFsFromItems([attachment], "all", {
    getItemsByIDs: () => [],
  });

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].itemID, 3);
  assert.equal(resolved[0].attachmentID, 30);
});
