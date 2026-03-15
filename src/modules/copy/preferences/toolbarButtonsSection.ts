import {
  getMainToolbarButtonEnabled,
  getReaderToolbarButtonEnabled,
  setPref,
} from "../../../utils/prefs";
import {
  composeDisposables,
  createListenerDisposer,
  createNoopHandle,
} from "../ui/disposables";

export interface ToolbarButtonControls {
  mainToolbarCheckbox: HTMLInputElement;
  readerToolbarCheckbox: HTMLInputElement;
}

export function readToolbarButtonVisibility(controls: ToolbarButtonControls): {
  showMainToolbarButton: boolean;
  showReaderToolbarButton: boolean;
} {
  return {
    showMainToolbarButton: controls.mainToolbarCheckbox.checked,
    showReaderToolbarButton: controls.readerToolbarCheckbox.checked,
  };
}

export function persistToolbarButtonPrefs(
  controls: ToolbarButtonControls,
  setPreference: (
    key: "showMainToolbarButton" | "showReaderToolbarButton",
    value: boolean,
  ) => unknown = setPref,
): void {
  const visibility = readToolbarButtonVisibility(controls);
  setPreference("showMainToolbarButton", visibility.showMainToolbarButton);
  setPreference("showReaderToolbarButton", visibility.showReaderToolbarButton);
}

export async function registerToolbarButtonsSection(doc: Document): Promise<{
  dispose(): void;
}> {
  const controls = getToolbarButtonControls(doc);
  if (!controls) {
    return createNoopHandle();
  }

  syncToolbarButtonControls(controls);
  const persist = () => persistToolbarButtonPrefs(controls);
  const disposers = [
    createListenerDisposer(controls.mainToolbarCheckbox, "change", persist),
    createListenerDisposer(controls.readerToolbarCheckbox, "change", persist),
  ];

  return composeDisposables(...disposers);
}

function getToolbarButtonControls(
  doc: Document,
): ToolbarButtonControls | undefined {
  const mainToolbarCheckbox = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-main-toolbar-button]",
  );
  const readerToolbarCheckbox = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-reader-toolbar-button]",
  );

  if (!mainToolbarCheckbox || !readerToolbarCheckbox) {
    return undefined;
  }

  return {
    mainToolbarCheckbox,
    readerToolbarCheckbox,
  };
}

function syncToolbarButtonControls(controls: ToolbarButtonControls): void {
  controls.mainToolbarCheckbox.checked = getMainToolbarButtonEnabled();
  controls.readerToolbarCheckbox.checked = getReaderToolbarButtonEnabled();
}
