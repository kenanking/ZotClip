import { config } from "../../../package.json";
import { TOOLBAR_ICON_URL, getToolbarTooltipText } from "./copyUi";
import { createAvailabilityCoordinator } from "./runtime/availabilityCoordinator";

const BUTTON_ID = `${config.addonRef}-main-toolbar-button`;
const TOOLBAR_ANCHOR_IDS = ["zotero-tb-note-add"];

type ToolbarButtonElement = XULElement & {
  disabled: boolean;
  title: string;
  remove(): void;
};

type XULDocumentLike = Document & {
  createXULElement?: (tagName: string) => Element;
};

export interface MainToolbarButtonAvailability {
  canCopy: boolean;
  unavailableMessage?: string;
}

export interface MainToolbarButtonDeps {
  getLabel(): string;
  getRefreshKey?(): string;
  getAvailability(): Promise<MainToolbarButtonAvailability>;
  onCommand(): Promise<void>;
}

export interface MainToolbarButtonHandle {
  refresh(): Promise<void>;
  dispose(): void;
}

export function registerMainToolbarButton(
  doc: Document,
  deps: MainToolbarButtonDeps,
): MainToolbarButtonHandle {
  const button = ensureButton(doc, deps.getLabel());
  const availabilityCoordinator = createAvailabilityCoordinator();

  const onCommand = (event: Event) => {
    const currentButton = event.currentTarget as ToolbarButtonElement | null;
    if (currentButton?.disabled) {
      return;
    }

    void deps.onCommand().then(() => {
      availabilityCoordinator.notifySelectionCopyCompleted();
      void refresh();
    });
  };

  button?.addEventListener("command", onCommand);

  async function refresh(): Promise<void> {
    const refreshKey = deps.getRefreshKey?.();
    if (refreshKey) {
      return availabilityCoordinator.requestSelectionRefresh(
        refreshKey,
        refreshCurrentAvailability,
      );
    }

    return refreshCurrentAvailability();
  }

  async function refreshCurrentAvailability(): Promise<void> {
    const currentButton = ensureButton(doc, deps.getLabel());
    if (!currentButton) {
      return;
    }

    const availability = await deps.getAvailability();
    currentButton.disabled = !availability.canCopy;
    currentButton.title = getToolbarTooltipText(deps.getLabel(), availability);
    currentButton.setAttribute("tooltiptext", currentButton.title);
  }

  return {
    refresh,
    dispose: () => {
      const currentButton = doc.getElementById(
        BUTTON_ID,
      ) as ToolbarButtonElement | null;
      currentButton?.removeEventListener("command", onCommand);
      currentButton?.remove?.();
    },
  };
}

function ensureButton(
  doc: Document,
  label: string,
): ToolbarButtonElement | null {
  const existing = doc.getElementById(BUTTON_ID) as ToolbarButtonElement | null;
  if (existing) {
    return existing;
  }

  const anchor = findToolbarAnchor(doc);
  if (!anchor) {
    return null;
  }

  const button = createButton(doc, label);
  anchor.after(button);
  return button;
}

function findToolbarAnchor(doc: Document): Element | null {
  for (const id of TOOLBAR_ANCHOR_IDS) {
    const anchor = doc.getElementById(id);
    if (anchor) {
      return anchor;
    }
  }

  return null;
}

function createButton(doc: Document, label: string): ToolbarButtonElement {
  const xulDoc = doc as XULDocumentLike;
  const button = (xulDoc.createXULElement
    ? xulDoc.createXULElement("toolbarbutton")
    : doc.createElement("toolbarbutton")) as unknown as ToolbarButtonElement;
  button.id = BUTTON_ID;
  button.className = "zotero-tb-button";
  button.setAttribute("tooltiptext", label);
  button.title = label;
  button.setAttribute("style", `list-style-image: url(${TOOLBAR_ICON_URL})`);
  return button;
}
