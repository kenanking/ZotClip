import assert from "node:assert/strict";
import test from "node:test";
import { createMainToolbarActionState } from "../../src/modules/copy/actionStateFactory";
import type { MainToolbarCopyButtonDeps } from "../../src/modules/copy/toolbarButtonDeps";

test("toolbar command retains the items and attachment settings captured before lookup", async () => {
  const originalItems = [{ id: 1 }] as Zotero.Item[];
  let selectedItems = originalItems;
  let mode: "all" | "primary" = "all";
  const types = ["pdf"];
  let resume!: () => void;
  const barrier = new Promise<void>((resolve) => {
    resume = resolve;
  });
  let copied: unknown[] = [];
  const pending = createMainToolbarActionState(
    {} as Window,
    {
      getSelectedItems: () => selectedItems,
      getMode: () => mode,
      getAllowedTypes: () => types,
      resolveFromItems: async () => {
        await barrier;
        return [];
      },
      executeCopy: async (...args) => {
        copied = args;
        return { ok: true, format: "file-object", count: 1 };
      },
    } as unknown as MainToolbarCopyButtonDeps,
  );
  selectedItems = [{ id: 2 }] as Zotero.Item[];
  mode = "primary";
  types.push("epub");
  resume();
  const state = await pending;
  await state.primary.run();
  assert.deepEqual(copied, [originalItems, "all", ["pdf"]]);
});
