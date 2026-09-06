import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { createTaskCard } from "./taskCard";

export function showNotification(
  text: string,
  closeTime = 5000,
  doc: Document = getNotificationDocument(),
): void {
  if (!doc.defaultView || doc.defaultView.closed) return;
  createTaskCard(
    doc,
    {
      title: config.addonName,
      close: getString("notification-close"),
      cancel: "",
      cancelling: "",
      retry: "",
    },
    () => {},
    "notification",
  ).finish(text, { closeTime });
}

/** Settings feedback always belongs to the main window, even with a reader active. */
export function showMainWindowNotification(text: string): void {
  showNotification(text, 5000, Zotero.getMainWindow().document);
}

function getNotificationDocument(): Document {
  const active = (Services.focus.activeWindow as Window | null)?.top;
  if (
    active &&
    (Zotero.getMainWindows().some((win) => win === active) ||
      Zotero.Reader._readers.some((reader) => reader._window === active))
  )
    return active.document;
  return Zotero.getMainWindow().document;
}
