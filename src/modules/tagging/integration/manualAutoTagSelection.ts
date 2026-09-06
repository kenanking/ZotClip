import { getAddonFaviconUri } from "../../../utils/addonAssets";
import { getString } from "../../../utils/locale";
import { autoTagItem } from "../core/autoTagService";
import { createAiTaskGroup } from "../core/taskManager";
import { createZoteroAutoTagDeps } from "../core/zoteroAutoTagDeps";
import { notifyAutoTagResult } from "./autoTagNotify";

const menuIcon = getAddonFaviconUri();

export async function executeAutoTagSelection(): Promise<void> {
  const pane = Zotero.getActiveZoteroPane();
  if (!pane) {
    return;
  }

  const regularItems = pane
    .getSelectedItems()
    .filter((item) => item.isRegularItem());

  if (regularItems.length === 0) {
    notifyAutoTagResult("auto-tag-no-selection");
    return;
  }

  const total = regularItems.length;
  const group = createAiTaskGroup();
  const doc = pane.document;
  const cancelButton = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "button",
  );
  cancelButton.textContent = getString("auto-tag-cancel");
  cancelButton.addEventListener("click", group.cancel);
  const status = doc.createElementNS("http://www.w3.org/1999/xhtml", "aside");
  status.setAttribute("role", "status");
  (status as HTMLElement).style.cssText =
    "display:flex;gap:8px;align-items:center;padding:8px;";
  const statusText = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "span",
  );
  status.append(statusText, cancelButton);
  doc.documentElement?.appendChild(status);
  doc.defaultView?.addEventListener("unload", group.cancel, { once: true });

  const progressWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
  });
  progressWin.createLine({
    text: getString("auto-tag-batch-start", { args: { total } }),
    icon: menuIcon,
    progress: 0,
  });
  progressWin.show(0);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (let i = 0; i < total && !group.signal.aborted; i++) {
      const item = regularItems[i];

      statusText.textContent = getString("auto-tag-batch-progress", {
        args: { current: i + 1, total },
      });
      progressWin.changeLine({
        text: getString("auto-tag-batch-progress", {
          args: { current: i + 1, total },
        }),
        progress: Math.round((i / total) * 100),
      });

      try {
        const deps = await createZoteroAutoTagDeps(() => {}, {
          signal: group.signal,
          itemID: item.id,
          manual: true,
        });
        const result = await group.run(item.id, () => autoTagItem(item, deps));
        if (result.kind === "cancelled") break;

        if (result.kind === "ok") {
          if (result.tagsAdded.length > 0) {
            succeeded++;
          } else {
            skipped++;
          }
        } else if (result.kind === "skipped") {
          skipped++;
        } else {
          failed++;
          ztoolkit.log("[ZotClip] Auto-tag failed:", result.message);
        }
      } catch {
        if (!group.signal.aborted) failed++;
      }
    }

    const cancelled = group.signal.aborted;
    const summaryKey = cancelled
      ? "auto-tag-cancelled"
      : failed > 0
        ? "auto-tag-batch-done-mixed"
        : "auto-tag-batch-done";

    progressWin.changeLine({
      text: getString(summaryKey, { args: { succeeded, skipped, failed } }),
      progress: 100,
    });
    progressWin.show(4000);
  } finally {
    status.remove();
    doc.defaultView?.removeEventListener("unload", group.cancel);
    group.dispose();
  }
}
