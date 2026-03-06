import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAttachmentsFromItems,
} from "../../src/modules/copy/attachmentResolver";

function makeAttachment(
  id: number,
  path: string | false,
  options: { parentID?: number } = {},
) {
  return {
    id,
    parentID: options.parentID,
    isAttachment: () => true,
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

test("AttachmentResolver: collects all allowed children in all mode", async () => {
  const a1 = makeAttachment(11, "C:/papers/a.pdf", { parentID: 1 });
  const a2 = makeAttachment(12, "C:/books/b.epub", { parentID: 1 });
  const a3 = makeAttachment(13, "C:/notes/c.txt", { parentID: 1 });
  const regular = makeRegular(1, [11, 12, 13]);

  const resolved = await resolveAttachmentsFromItems(
    [regular],
    "all",
    ["pdf", "epub"],
    {
      getItemsByIDs: () => [a1, a2, a3],
    },
  );

  assert.equal(resolved.length, 2);
  assert.deepEqual(
    resolved.map((r) => r.path),
    ["C:/papers/a.pdf", "C:/books/b.epub"],
  );
});

test("AttachmentResolver: primary mode falls back to first allowed child", async () => {
  const bestDisallowed = makeAttachment(21, "C:/notes/not-allowed.txt", {
    parentID: 2,
  });
  const allowedFallback = makeAttachment(22, "C:/books/primary.epub", {
    parentID: 2,
  });
  const otherDisallowed = makeAttachment(23, "C:/notes/other.txt", {
    parentID: 2,
  });
  const regular = makeRegular(2, [21, 22, 23], {
    bestMany: [bestDisallowed],
    bestOne: bestDisallowed,
  });

  const resolved = await resolveAttachmentsFromItems(
    [regular],
    "primary",
    ["epub"],
    {
      getItemsByIDs: () => [bestDisallowed, allowedFallback, otherDisallowed],
    },
  );

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].attachmentID, 22);
  assert.equal(resolved[0].path, "C:/books/primary.epub");
});

test("AttachmentResolver: accepts selected attachment directly when type is allowed", async () => {
  const attachment = makeAttachment(30, "C:/papers/direct.pdf", {
    parentID: 3,
  });

  const resolved = await resolveAttachmentsFromItems(
    [attachment],
    "all",
    ["pdf"],
    {
      getItemsByIDs: () => [],
    },
  );

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].itemID, 3);
  assert.equal(resolved[0].attachmentID, 30);
});
