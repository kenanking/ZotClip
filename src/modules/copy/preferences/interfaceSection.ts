import {
  getContextMenuEntryEnabled,
  getMainToolbarButtonEnabled,
  getReaderToolbarButtonEnabled,
  setPref,
} from "../../../utils/prefs";
import {
  composeDisposables,
  createListenerDisposer,
  createNoopHandle,
} from "../ui/disposables";

export function registerInterfaceSection(doc: Document): { dispose(): void } {
  const contextMenuCheckbox = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-context-menu-entry]",
  );
  const mainToolbarCheckbox = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-main-toolbar-button]",
  );
  const readerToolbarCheckbox = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-reader-toolbar-button]",
  );

  if (!contextMenuCheckbox || !mainToolbarCheckbox || !readerToolbarCheckbox) {
    return createNoopHandle();
  }

  contextMenuCheckbox.checked = getContextMenuEntryEnabled();
  mainToolbarCheckbox.checked = getMainToolbarButtonEnabled();
  readerToolbarCheckbox.checked = getReaderToolbarButtonEnabled();

  const disposers = [
    createListenerDisposer(contextMenuCheckbox, "change", () => {
      setPref("showContextMenuEntry", contextMenuCheckbox.checked);
    }),
    createListenerDisposer(mainToolbarCheckbox, "change", () => {
      setPref("showMainToolbarButton", mainToolbarCheckbox.checked);
    }),
    createListenerDisposer(readerToolbarCheckbox, "change", () => {
      setPref("showReaderToolbarButton", readerToolbarCheckbox.checked);
    }),
  ];

  return composeDisposables(...disposers);
}
