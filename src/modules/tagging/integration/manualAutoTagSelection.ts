import { getAddonFaviconUri } from "../../../utils/addonAssets";
import { getString } from "../../../utils/locale";
import { autoTagItem } from "../core/autoTagService";
import { runWithAiTagGap } from "../core/autoTagQueue";
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

  for (let i = 0; i < total; i++) {
    const item = regularItems[i];

    progressWin.changeLine({
      text: getString("auto-tag-batch-progress", {
        args: { current: i + 1, total },
      }),
      progress: Math.round((i / total) * 100),
    });

    try {
      const result = await runWithAiTagGap(() =>
        autoTagItem(
          item,
          createZoteroAutoTagDeps(() => {}),
        ),
      );

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
    } catch (error) {
      failed++;
      Zotero.logError(
        error instanceof Error
          ? error
          : new Error(`[ZotClip] Auto-tag failed: ${String(error)}`),
      );
    }
  }

  const summaryKey =
    failed > 0 ? "auto-tag-batch-done-mixed" : "auto-tag-batch-done";

  progressWin.changeLine({
    text: getString(summaryKey, { args: { succeeded, skipped, failed } }),
    progress: 100,
  });
  progressWin.show(4000);
}
