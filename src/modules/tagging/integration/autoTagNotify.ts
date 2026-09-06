import {
  createTaskCard,
  getTaskCard,
  type ProgressLabels,
} from "../../../ui/taskCard";
import type { FluentMessageId } from "../../../../typings/i10n";
import { showNotification } from "../../../ui/notification";
import { getString } from "../../../utils/locale";

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
  showNotification(message);
}

export function getAutoTagTaskLabels(): ProgressLabels {
  return {
    title: getString("auto-tag-panel-title"),
    cancel: getString("auto-tag-panel-cancel"),
    cancelling: getString("auto-tag-panel-cancelling"),
    close: getString("notification-close"),
    retry: getString("auto-tag-panel-retry"),
  };
}

export function notifyAutoTagBackgroundFailures(count: number): void {
  const doc = Zotero.getMainWindow()?.document;
  if (!doc) return;
  const message = getString("auto-tag-background-failed", { args: { count } });
  const existing = getTaskCard(doc);
  if (existing) existing.notice(message);
  else
    createTaskCard(doc, getAutoTagTaskLabels(), () => {}).finish(message, {
      persistent: true,
    });
}
