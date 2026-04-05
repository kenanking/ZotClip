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

  for (const item of regularItems) {
    const progressWin = new ztoolkit.ProgressWindow(
      addon.data.config.addonName,
      { closeOnClick: true },
    );
    progressWin.createLine({
      text: getString("auto-tag-progress-start"),
      icon: menuIcon,
      progress: 10,
    });
    progressWin.show(0);

    try {
      const result = await runWithAiTagGap(() =>
        autoTagItem(
          item,
          createZoteroAutoTagDeps((update) => {
            let text = update.text;
            switch (update.phase) {
              case "start":
                text = getString("auto-tag-progress-start");
                break;
              case "calling":
                text = getString("auto-tag-progress-calling");
                break;
              case "done":
                text = update.text.trim()
                  ? getString("auto-tag-result-tags", {
                      args: { tags: update.text },
                    })
                  : getString("auto-tag-no-tags-suggested");
                break;
              case "error":
                text = getString("auto-tag-failed", {
                  args: { error: update.text },
                });
                break;
            }
            progressWin.changeLine({
              text,
              progress: update.progress,
            });
          }),
        ),
      );

      if (result.kind === "skipped") {
        progressWin.changeLine({
          text:
            result.reason === "noTitle"
              ? getString("auto-tag-no-title")
              : getString("auto-tag-no-api-key"),
          progress: 100,
        });
      }
    } finally {
      progressWin.show(2000);
    }
  }
}
