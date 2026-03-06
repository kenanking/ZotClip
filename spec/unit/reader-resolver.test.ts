import assert from "node:assert/strict";
import test from "node:test";

import { resolveAttachmentFromReader } from "../../src/modules/copy/attachmentResolver";

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

test("reader resolver resolves current reader attachment when type is allowed", async () => {
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

test("reader resolver rejects current reader attachment when type is not allowed", async () => {
  const attachment = makeAttachment(1002, "C:/books/reader.epub", {
    parentID: 91,
  });

  const resolved = await resolveAttachmentFromReader(1002, ["pdf"], {
    getItemsByIDs: () => [],
    getItemByID: () => attachment,
  });

  assert.deepEqual(resolved, []);
});
