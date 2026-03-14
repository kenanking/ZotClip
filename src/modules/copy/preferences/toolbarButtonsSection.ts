import {
  getMainToolbarButtonEnabled,
  getReaderToolbarButtonEnabled,
  setPref,
} from "../../../utils/prefs";

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
    addEventListener(controls.mainToolbarCheckbox, "change", persist),
    addEventListener(controls.readerToolbarCheckbox, "change", persist),
  ];

  return {
    dispose(): void {
      for (const dispose of disposers) {
        dispose();
      }
    },
  };
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

function createNoopHandle(): { dispose(): void } {
  return {
    dispose(): void {},
  };
}

function addEventListener<T extends EventTarget>(
  target: T,
  type: string,
  listener: EventListener,
): () => void {
  target.addEventListener(type, listener);
  return () => {
    target.removeEventListener(type, listener);
  };
}
