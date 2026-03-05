import assert from "node:assert/strict";
import test from "node:test";

import { resolvePDFFromReader } from "../../src/modules/copy/attachmentResolver";

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

test("reader resolver resolves current reader attachment item to one PDF", async () => {
  const attachment = makeAttachment(1001, "C:/papers/reader.pdf", {
    parentID: 90,
  });

  const resolved = await resolvePDFFromReader(1001, {
    getItemsByIDs: () => [],
    getItemByID: () => attachment,
  });

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].itemID, 90);
  assert.equal(resolved[0].attachmentID, 1001);
  assert.equal(resolved[0].path, "C:/papers/reader.pdf");
});
