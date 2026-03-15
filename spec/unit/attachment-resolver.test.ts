import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAttachmentFromReader,
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
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

test("AttachmentResolver: resolves current reader attachment when type is allowed", async () => {
  const attachment = makeAttachment(1001, "C:/papers/reader.pdf", {
    parentID: 90,
  });

  const resolved = await resolveAttachmentFromReader(1001, ["pdf"], {
    getItemsByIDs: () => [],
    getItemByID: () => attachment,
  });

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].itemID, 90);
  assert.equal(resolved[0].attachmentID, 1001);
  assert.equal(resolved[0].path, "C:/papers/reader.pdf");
});

test("AttachmentResolver: resolves allowed attachment paths concurrently while preserving attachment order", async () => {
  let started = 0;
  const first = createDeferred<string | false>();
  const second = createDeferred<string | false>();
  const third = createDeferred<string | false>();
  const waits = [first, second, third];

  const attachments = waits.map((wait, index) => ({
    id: index + 1,
    parentID: 10,
    isAttachment: () => true,
    getFilePathAsync: async () => {
      started += 1;
      return wait.promise;
    },
  })) as Zotero.Item[];
  const regular = makeRegular(10, [1, 2, 3]);

  const resolvedPromise = resolveAttachmentsFromItems(
    [regular],
    "all",
    ["pdf"],
    {
      getItemsByIDs: () => attachments,
    },
  );

  await Promise.resolve();
  assert.equal(started, 3);

  third.resolve("C:/papers/c.pdf");
  second.resolve("C:/papers/b.pdf");
  first.resolve("C:/papers/a.pdf");

  const resolved = await resolvedPromise;

  assert.deepEqual(
    resolved.map((entry) => entry.path),
    ["C:/papers/a.pdf", "C:/papers/b.pdf", "C:/papers/c.pdf"],
  );
});

test("AttachmentResolver: primary mode does not scan child attachments when the best attachment is already allowed", async () => {
  const bestAllowed = makeAttachment(31, "C:/papers/best.pdf", {
    parentID: 3,
  });
  const regular = makeRegular(3, [31], {
    bestMany: [bestAllowed],
    bestOne: bestAllowed,
  });
  let childLookupCalls = 0;

  const resolved = await resolveAttachmentsFromItems(
    [regular],
    "primary",
    ["pdf"],
    {
      getItemsByIDs: () => {
        childLookupCalls += 1;
        return [bestAllowed];
      },
    },
  );

  assert.equal(childLookupCalls, 0);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].attachmentID, 31);
});

test("AttachmentResolver: rejects current reader attachment when type is not allowed", async () => {
  const attachment = makeAttachment(1002, "C:/books/reader.epub", {
    parentID: 91,
  });

  const resolved = await resolveAttachmentFromReader(1002, ["pdf"], {
    getItemsByIDs: () => [],
    getItemByID: () => attachment,
  });

  assert.deepEqual(resolved, []);
});
