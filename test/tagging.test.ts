import { autoTagItem } from "../src/modules/tagging/core/autoTagService";
import { createZoteroAutoTagDeps } from "../src/modules/tagging/core/zoteroAutoTagDeps";

const response = JSON.stringify({
  choices: [
    { message: { content: JSON.stringify({ tags: ["ZotClip test tag"] }) } },
  ],
});

describe("AI tag persistence", function () {
  let item: Zotero.Item;
  let history:
    | {
        clear(): void;
        canUndo(): boolean;
        undo(): Promise<boolean>;
        redo(): Promise<boolean>;
      }
    | undefined;

  before(function () {
    history = (
      Zotero as unknown as {
        UndoHistory?: {
          clear(): void;
          canUndo(): boolean;
          undo(): Promise<boolean>;
          redo(): Promise<boolean>;
        };
      }
    ).UndoHistory;
  });

  beforeEach(async function () {
    item = new Zotero.Item("journalArticle");
    item.setField("title", "Isolated ZotClip integration fixture");
    await item.saveTx();
    history?.clear();
  });

  afterEach(async function () {
    history?.clear();
    await item.eraseTx();
  });

  async function deps(manual: boolean, signal?: AbortSignal) {
    const result = await createZoteroAutoTagDeps(() => {}, {
      itemID: item.id,
      manual,
      signal,
    });
    result.isApiKeyRequired = () => false;
    result.httpRequest = async () => ({ response });
    return result;
  }

  it("persists manual tags and supports Zotero 10 undo and redo", async function () {
    assert.equal((await autoTagItem(item, await deps(true))).kind, "ok");
    assert.ok(item.hasTag("ZotClip test tag"));
    if (Number.parseInt(Zotero.version, 10) >= 10) {
      assert.ok(history?.canUndo());
      assert.equal(await history!.undo(), true);
      assert.equal(item.hasTag("ZotClip test tag"), false);
      assert.equal(await history!.redo(), true);
      assert.ok(item.hasTag("ZotClip test tag"));
    }
  });

  it("keeps background tagging out of the undo stack", async function () {
    await autoTagItem(item, await deps(false));
    assert.ok(item.hasTag("ZotClip test tag"));
    if (history) assert.equal(history.canUndo(), false);
  });

  it("does not write a response received after cancellation", async function () {
    const controller = new AbortController();
    const request = await deps(true, controller.signal);
    request.httpRequest = async () => {
      controller.abort();
      return { response };
    };
    assert.equal((await autoTagItem(item, request)).kind, "cancelled");
    assert.equal(item.hasTag("ZotClip test tag"), false);
  });

  it("does not write to an item trashed while a request is running", async function () {
    const request = await deps(true);
    request.httpRequest = async () => {
      item.deleted = true;
      await item.saveTx();
      return { response };
    };
    assert.deepEqual(await autoTagItem(item, request), {
      kind: "skipped",
      reason: "notEditable",
    });
    assert.equal(item.hasTag("ZotClip test tag"), false);
  });
});
