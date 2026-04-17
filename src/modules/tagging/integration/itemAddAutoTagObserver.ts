import {
  getAutoTaggingEnabled,
  getAutoTagOnAdd,
  getStripConnectorTags,
} from "../../../utils/prefs";
import { autoTagItem } from "../core/autoTagService";
import { runWithAiTagGap } from "../core/autoTagQueue";
import { createZoteroAutoTagDeps } from "../core/zoteroAutoTagDeps";
import { notifyAutoTagResult } from "./autoTagNotify";
import { isItemEligibleForAutoTagOnAdd } from "./itemAddAutoTagEligibility";

const ITEM_ADD_DELAY_MS = 500;

async function stripConnectorTags(item: Zotero.Item): Promise<void> {
  const tags = item.getTags();
  let changed = false;
  for (const tag of tags) {
    if (tag.type === 1) {
      item.removeTag(tag.tag);
      changed = true;
    }
  }
  if (changed) {
    await item.saveTx();
  }
}

async function autoTagNewLibraryItem(item: Zotero.Item): Promise<void> {
  const title = (item.getField("title") as string) || "";
  const result = await runWithAiTagGap(() =>
    autoTagItem(
      item,
      createZoteroAutoTagDeps(() => {}),
    ),
  );

  if (result.kind === "failed") {
    notifyAutoTagResult("auto-tag-failed", {
      args: { error: result.message },
    });
    return;
  }

  if (result.kind !== "ok" || result.tagsAdded.length === 0) {
    return;
  }

  const shortTitle =
    title.length > 20 ? title.slice(0, 20) + "..." : title || "…";
  notifyAutoTagResult("auto-tag-success", {
    args: { title: shortTitle, count: result.tagsAdded.length },
  });
}

export function registerAutoTagItemAddObserver(): { dispose(): void } {
  let disposed = false;
  const batchQueue: number[][] = [];
  let draining = false;

  async function drainBatchQueue(): Promise<void> {
    if (draining || disposed) {
      return;
    }
    draining = true;
    try {
      while (batchQueue.length > 0 && !disposed) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, ITEM_ADD_DELAY_MS);
        });
        if (disposed) {
          return;
        }
        const batch = batchQueue.shift();
        if (!batch) {
          continue;
        }
        for (const id of batch) {
          if (disposed) {
            return;
          }
          const item = await Zotero.Items.getAsync(id);
          if (!item || !isItemEligibleForAutoTagOnAdd(item)) {
            continue;
          }

          if (getStripConnectorTags()) {
            await stripConnectorTags(item);
          }

          if (getAutoTagOnAdd() && getAutoTaggingEnabled()) {
            await autoTagNewLibraryItem(item);
          }
        }
      }
    } finally {
      draining = false;
      if (batchQueue.length > 0 && !disposed) {
        void drainBatchQueue();
      }
    }
  }

  function enqueueBatch(
    ids: string[] | number[],
    extraData: _ZoteroTypes.anyObj,
  ): void {
    const numeric = ids
      .map((id) => (typeof id === "string" ? parseInt(id, 10) : id))
      .filter((id) => {
        if (Number.isNaN(id)) return false;
        // Skip items added during sync or bulk operations (e.g., cloud sync),
        // which set skipSelect to avoid auto-selection.
        if (extraData?.[id]?.skipSelect === true) {
          return false;
        }
        return true;
      });
    if (!numeric.length) {
      return;
    }
    batchQueue.push(numeric);
    void drainBatchQueue();
  }

  const observerId = Zotero.Notifier.registerObserver(
    {
      notify: (
        event: _ZoteroTypes.Notifier.Event,
        type: _ZoteroTypes.Notifier.Type,
        ids: string[] | number[],
        extraData: _ZoteroTypes.anyObj,
      ) => {
        if (event !== "add" || type !== "item" || !ids?.length) {
          return;
        }
        enqueueBatch(ids, extraData);
      },
    },
    ["item"],
    "zotclip",
  );

  return {
    dispose(): void {
      disposed = true;
      batchQueue.length = 0;
      Zotero.Notifier.unregisterObserver(observerId);
    },
  };
}
