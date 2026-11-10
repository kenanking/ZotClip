import assert from "node:assert/strict";
import test from "node:test";
import {
  copyFromReader,
  copyFromReaderItem,
  copyFromSelection,
  type CopyCommandDeps,
} from "../../src/modules/copy/copyCommands";
import {
  checkReaderAvailability,
  checkSelectionAvailability,
} from "../../src/modules/copy/copyAvailability";

const files = [{ itemID: 1, attachmentID: 11, path: "/tmp/paper.pdf" }];
const success = { ok: true, format: "file-object" as const, count: 1 };
const deps: CopyCommandDeps = {
  getSelectedItems: () => [{ id: 1 }] as Zotero.Item[],
  getCurrentReaderItemID: () => 42,
  resolveFromItems: async () => files,
  resolveFromReader: async () => files,
  writeClipboard: async () => success,
};

test("copyFromSelection passes selected items, settings and files to the clipboard", async () => {
  const result = await copyFromSelection("primary", ["pdf"], {
    ...deps,
    resolveFromItems: async (items, mode, allowedTypes) => {
      assert.deepEqual(items, [{ id: 1 }]);
      assert.equal(mode, "primary");
      assert.deepEqual(allowedTypes, ["pdf"]);
      return files;
    },
    writeClipboard: async (resolved, source) => {
      assert.equal(resolved, files);
      assert.equal(source, "library");
      return success;
    },
  });
  assert.equal(result, success);
});

test("copyFromSelection preserves the clipboard's empty-selection result", async () => {
  const empty = { ok: false, format: "none" as const, count: 0 };
  assert.equal(
    await copyFromSelection("all", ["pdf"], {
      ...deps,
      resolveFromItems: async () => [],
      writeClipboard: async (resolved, source) => {
        assert.deepEqual(resolved, []);
        assert.equal(source, "library");
        return empty;
      },
    }),
    empty,
  );
});

test("copyFromReader resolves the active reader and preserves clipboard results", async () => {
  const result = await copyFromReader(["epub"], {
    ...deps,
    resolveFromReader: async (itemID, allowedTypes) => {
      assert.equal(itemID, 42);
      assert.deepEqual(allowedTypes, ["epub"]);
      return files;
    },
    writeClipboard: async (resolved, source) => {
      assert.equal(resolved, files);
      assert.equal(source, "reader");
      return success;
    },
  });
  assert.equal(result, success);
});

test("copyFromReaderItem uses the specified reader without reading the active tab", async () => {
  assert.equal(
    await copyFromReaderItem(99, ["pdf"], {
      ...deps,
      getCurrentReaderItemID: () => assert.fail("Must use the captured reader"),
      resolveFromReader: async (itemID) => {
        assert.equal(itemID, 99);
        return files;
      },
    }),
    success,
  );
});

test("copyFromReader returns early when there is no active reader", async () => {
  assert.deepEqual(
    await copyFromReader(["pdf"], {
      ...deps,
      getCurrentReaderItemID: () => undefined,
      resolveFromReader: async () => assert.fail("No reader to resolve"),
      writeClipboard: async () => assert.fail("Must leave the clipboard alone"),
    }),
    {
      ok: false,
      format: "none",
      count: 0,
      messageKey: "copy-reader-no-active",
    },
  );
});

test("reader availability returns early when there is no active reader", async () => {
  assert.deepEqual(
    await checkReaderAvailability(undefined, ["pdf"], async () =>
      assert.fail("No reader to resolve"),
    ),
    { canCopy: false, messageKey: "copy-reader-no-active" },
  );
});

test("reader availability follows resolved attachments", async () => {
  for (const resolved of [[], files]) {
    assert.deepEqual(
      await checkReaderAvailability(42, ["epub"], async (itemID, types) => {
        assert.equal(itemID, 42);
        assert.deepEqual(types, ["epub"]);
        return resolved;
      }),
      resolved.length
        ? { canCopy: true }
        : { canCopy: false, messageKey: "copy-no-files" },
    );
  }
});

test("selection availability passes the captured settings and items to the resolver", async () => {
  const items = deps.getSelectedItems();
  for (const resolved of [[], files]) {
    assert.deepEqual(
      await checkSelectionAvailability(
        { allowedTypes: ["pdf"], multiAttachmentMode: "all" },
        items,
        async (selected, mode, types) => {
          assert.equal(selected, items);
          assert.equal(mode, "all");
          assert.deepEqual(types, ["pdf"]);
          return resolved;
        },
      ),
      resolved.length
        ? { canCopy: true }
        : { canCopy: false, messageKey: "copy-no-files" },
    );
  }
});
