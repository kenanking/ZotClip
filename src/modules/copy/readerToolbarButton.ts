import { config } from "../../../package.json";

const BUTTON_ID = `${config.addonRef}-reader-copy-button`;
const TOOLBAR_SELECTORS = [
  "#reader-toolbar .toolbar-end",
  "#reader-toolbar",
  ".reader-toolbar .toolbar-end",
  ".reader-toolbar",
];

export interface ReaderButtonAvailability {
  canCopy: boolean;
  unavailableMessage?: string;
}

export interface ReaderButtonStateInput {
  canCopy: boolean;
  label: string;
  shortcutLabel: string;
  unavailableMessage?: string;
}

export interface ReaderButtonState {
  disabled: boolean;
  label: string;
  tooltipText: string;
}

export interface ReaderToolbarButtonDeps {
  getLabel(): string;
  getShortcutLabel(): string;
  getAvailability(): Promise<ReaderButtonAvailability>;
  onCommand(): Promise<void>;
}

export function buildReaderButtonState(
  input: ReaderButtonStateInput,
): ReaderButtonState {
  if (!input.canCopy) {
    return {
      disabled: true,
      label: input.label,
      tooltipText: input.unavailableMessage || input.label,
    };
  }

  const shortcutSuffix = input.shortcutLabel
    ? ` (${input.shortcutLabel})`
    : "";

  return {
    disabled: false,
    label: input.label,
    tooltipText: `${input.label}${shortcutSuffix}`,
  };
}

export function registerReaderToolbarButton(
  win: Window,
  deps: ReaderToolbarButtonDeps,
): () => void {
  const refresh = async () => {
    const button = ensureButton(win.document, deps);
    if (!button) {
      return;
    }

    const availability = await deps.getAvailability();
    const state = buildReaderButtonState({
      canCopy: availability.canCopy,
      label: deps.getLabel(),
      shortcutLabel: deps.getShortcutLabel(),
      unavailableMessage: availability.unavailableMessage,
    });

    applyButtonState(button, state);
  };

  const onCommand = (event: Event) => {
    const button = event.currentTarget as HTMLButtonElement | null;
    if (button?.disabled) {
      return;
    }

    void deps.onCommand().then(() => {
      void refresh();
    });
  };

  const onRefreshEvent = () => {
    void refresh();
  };

  const button = ensureButton(win.document, deps);
  button?.addEventListener("command", onCommand);
  button?.addEventListener("click", onCommand);

  win.addEventListener("focus", onRefreshEvent, true);
  win.addEventListener("pageshow", onRefreshEvent, true);
  win.document.addEventListener("focusin", onRefreshEvent, true);

  void refresh();

  return () => {
    const currentButton = win.document.getElementById(BUTTON_ID);
    currentButton?.removeEventListener("command", onCommand);
    currentButton?.removeEventListener("click", onCommand);
    currentButton?.remove();
    win.removeEventListener("focus", onRefreshEvent, true);
    win.removeEventListener("pageshow", onRefreshEvent, true);
    win.document.removeEventListener("focusin", onRefreshEvent, true);
  };
}

function ensureButton(
  doc: Document,
  deps: Pick<ReaderToolbarButtonDeps, "getLabel">,
): HTMLButtonElement | null {
  const container = findToolbarContainer(doc);
  if (!container) {
    return null;
  }

  const existing = doc.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (existing) {
    return existing;
  }

  const button = createButton(doc, deps.getLabel());
  container.append(button);
  return button;
}

function findToolbarContainer(doc: Document): Element | null {
  for (const selector of TOOLBAR_SELECTORS) {
    const container = doc.querySelector(selector);
    if (container) {
      return container;
    }
  }

  return null;
}

function createButton(doc: Document, label: string): HTMLButtonElement {
  const button = doc.createElement("button");
  button.id = BUTTON_ID;
  button.className = "toolbar-button zotclip-reader-toolbar-button";
  button.setAttribute("type", "button");
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = label;
  button.style.backgroundImage = `url(chrome://${config.addonRef}/content/icons/favicon.svg)`;
  button.style.backgroundPosition = "0.4rem center";
  button.style.backgroundRepeat = "no-repeat";
  button.style.paddingInlineStart = "1.8rem";

  return button;
}

function applyButtonState(
  button: HTMLButtonElement,
  state: ReaderButtonState,
): void {
  button.disabled = state.disabled;
  button.textContent = state.label;
  button.title = state.tooltipText;
  button.setAttribute("aria-label", state.tooltipText);
}
