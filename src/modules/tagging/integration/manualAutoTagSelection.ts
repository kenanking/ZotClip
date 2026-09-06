import { getAutoTaggingEnabled } from "../../../utils/prefs";
import { getString } from "../../../utils/locale";
import { autoTagItem } from "../core/autoTagService";
import { createAiTaskGroup } from "../core/taskManager";
import { createZoteroAutoTagDeps } from "../core/zoteroAutoTagDeps";
import { getTaskCard, createTaskCard } from "../../../ui/taskCard";
import { getAutoTagTaskLabels, notifyAutoTagResult } from "./autoTagNotify";

export async function executeAutoTagSelection(): Promise<void> {
  const pane = Zotero.getActiveZoteroPane();
  if (!pane) return;
  const existing = getTaskCard(pane.document);
  if (existing?.running) {
    existing.focus();
    return;
  }
  const items = pane.getSelectedItems().filter((item) => item.isRegularItem());
  if (!items.length) {
    notifyAutoTagResult("auto-tag-no-selection");
    return;
  }
  await runManualBatch(pane.document, items);
}

async function runManualBatch(
  doc: Document,
  items: Zotero.Item[],
): Promise<void> {
  if (doc.defaultView?.closed) return;
  const existing = getTaskCard(doc);
  if (existing?.running) {
    existing.focus();
    return;
  }
  if (!getAutoTaggingEnabled()) {
    createTaskCard(doc, getAutoTagTaskLabels(), () => {}).finish(
      getString("auto-tag-panel-disabled"),
      { persistent: true },
    );
    return;
  }
  const group = createAiTaskGroup();
  const panel = createTaskCard(doc, getAutoTagTaskLabels(), group.cancel);
  const onAbort = () => panel.cancelling();
  group.signal.addEventListener("abort", onAbort, { once: true });
  const total = items.length;
  let succeeded = 0;
  let skipped = 0;
  const failed: Zotero.Item[] = [];
  let needsKey = false;
  try {
    for (let i = 0; i < total && !group.signal.aborted; i++) {
      const item = items[i];
      panel.update(
        getString("auto-tag-batch-progress", {
          args: { current: i + 1, total },
        }),
        String(item.getField("title") || ""),
        i,
        total,
      );
      try {
        const deps = await createZoteroAutoTagDeps(() => {}, {
          signal: group.signal,
          itemID: item.id,
          manual: true,
        });
        const result = await group.run(item.id, () => autoTagItem(item, deps));
        if (result.kind === "cancelled") break;
        if (result.kind === "ok") {
          if (result.tagsAdded.length) succeeded++;
          else skipped++;
        } else if (result.kind === "skipped" && result.reason !== "noApiKey") {
          skipped++;
        } else {
          needsKey ||=
            result.kind === "skipped" && result.reason === "noApiKey";
          failed.push(item);
        }
      } catch {
        if (!group.signal.aborted) failed.push(item);
      }
    }
    const summary = getString(
      group.signal.aborted
        ? "auto-tag-panel-cancelled"
        : failed.length
          ? "auto-tag-batch-done-mixed"
          : "auto-tag-batch-done",
      { args: { succeeded, skipped, failed: failed.length } },
    );
    panel.finish(summary, {
      detail: needsKey ? getString("auto-tag-no-api-key") : undefined,
      persistent: group.signal.aborted || failed.length > 0,
      retry: failed.length
        ? () => {
            void runManualBatch(doc, failed);
          }
        : undefined,
    });
  } catch {
    panel.finish(getString("auto-tag-panel-error"), { persistent: true });
  } finally {
    group.signal.removeEventListener("abort", onAbort);
    group.dispose();
  }
}
