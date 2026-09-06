import { refreshItemTags } from "./refreshItemTags";
import {
  getAutoTaggingEnabled,
  getAutoTagOnAdd,
  getStripConnectorTags,
} from "../../../utils/prefs";
import { autoTagItem } from "../core/autoTagService";
import { createAiTaskGroup } from "../core/taskManager";
import { createZoteroAutoTagDeps } from "../core/zoteroAutoTagDeps";
import { notifyAutoTagBackgroundFailures } from "./autoTagNotify";
import type { AutoTagResult } from "../core/types";
import { isItemEligibleForAutoTagOnAdd } from "./itemAddAutoTagEligibility";

const ITEM_ADD_DELAY_MS = 500;

async function stripConnectorTags(item: Zotero.Item): Promise<boolean> {
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
    await refreshItemTags(item.id);
  }
  return changed;
}

async function autoTagNewLibraryItem(
  item: Zotero.Item,
  group: ReturnType<typeof createAiTaskGroup>,
): Promise<AutoTagResult> {
  const deps = await createZoteroAutoTagDeps(() => {}, {
    signal: group.signal,
    itemID: item.id,
  });
  return group.run(item.id, () => autoTagItem(item, deps));
}

export function registerAutoTagItemAddObserver(): { dispose(): void } {
  let disposed = false;
  const group = createAiTaskGroup();
  const batchQueue: number[][] = [];
  let draining = false;

  async function drainBatchQueue(): Promise<void> {
    if (draining || disposed) {
      return;
    }
    draining = true;
    let failureCount = 0;
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
          let tagsRemoved = false;
          try {
            const item = await Zotero.Items.getAsync(id);
            if (
              disposed ||
              !item ||
              item.deleted ||
              !item.isEditable() ||
              !isItemEligibleForAutoTagOnAdd(item)
            ) {
              continue;
            }

            if (getStripConnectorTags()) {
              tagsRemoved = await stripConnectorTags(item);
            }

            if (getAutoTagOnAdd() && getAutoTaggingEnabled()) {
              const result = await autoTagNewLibraryItem(item, group);
              if (
                result.kind === "failed" ||
                (result.kind === "skipped" && result.reason === "noApiKey")
              )
                failureCount++;
            }
          } catch {
            if (!disposed && !group.signal.aborted) failureCount++;
          } finally {
            // Reconcile again after AI saves/queued Connector notifications have settled.
            if (tagsRemoved && !disposed) await refreshItemTags(id);
          }
        }
      }
    } finally {
      draining = false;
      if (!disposed && failureCount)
        notifyAutoTagBackgroundFailures(failureCount);
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
      group.dispose();
      batchQueue.length = 0;
      Zotero.Notifier.unregisterObserver(observerId);
    },
  };
}
