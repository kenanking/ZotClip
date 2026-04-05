import type { FluentMessageId } from "../../../../typings/i10n";
import { getAddonFaviconUri } from "../../../utils/addonAssets";
import { getString } from "../../../utils/locale";

const notifyIcon = getAddonFaviconUri();

export type AutoTagNotifyMessageId = Extract<
  FluentMessageId,
  | "auto-tag-failed"
  | "auto-tag-no-api-key"
  | "auto-tag-no-selection"
  | "auto-tag-no-tags-suggested"
  | "auto-tag-no-title"
  | "auto-tag-success"
>;

export function notifyAutoTagResult(
  key: AutoTagNotifyMessageId,
  options?: { args?: Record<string, unknown> },
): void {
  const message =
    options === undefined ? getString(key) : getString(key, options);
  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeTime: 2000,
    closeOnClick: true,
  })
    .createLine({
      text: message,
      icon: notifyIcon,
      progress: 100,
    })
    .show();
}
