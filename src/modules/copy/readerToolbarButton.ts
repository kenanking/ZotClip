import { config } from "../../../package.json";
import { TOOLBAR_ICON_URL, getToolbarTooltipText } from "./copyUi";

const BUTTON_ID = `${config.addonRef}-reader-copy-button`;
const VERIFIED_CONTAINER_SELECTOR = ".custom-sections > .section";

export interface ReaderButtonAvailability {
  canCopy: boolean;
  unavailableMessage?: string;
}

export interface ReaderToolbarRenderEventLike {
  reader: {
    itemID?: number;
    _iframeWindow?: Window;
  };
  doc: Document;
  append: (...nodes: Array<Node | string>) => void;
}

export interface ReaderToolbarButtonDeps {
  getLabel(): string;
  getAvailability(
    itemID: number | undefined,
  ): Promise<ReaderButtonAvailability>;
  onCommand(itemID: number | undefined): Promise<void>;
}

export interface ReaderToolbarButtonHandle {
  refresh(): Promise<void>;
  dispose(): void;
}

interface ReaderToolbarAPI {
  registerEventListener(
    type: "renderToolbar",
    handler: (event: ReaderToolbarRenderEventLike) => void,
    pluginID?: string,
  ): void;
  unregisterEventListener(
    type: "renderToolbar",
    handler: (event: ReaderToolbarRenderEventLike) => void,
  ): void;
  _readers?: Array<{
    itemID?: number;
    _iframeWindow?: Window;
  }>;
}

export interface ReaderToolbarRegistryDeps extends ReaderToolbarButtonDeps {
  pluginID?: string;
  readerAPI?: ReaderToolbarAPI;
}

export function mountReaderToolbarButton(
  event: ReaderToolbarRenderEventLike,
  deps: ReaderToolbarButtonDeps,
): ReaderToolbarButtonHandle {
  const button = ensureButton(event.doc, deps.getLabel(), (...nodes) => {
    event.append(...nodes);
  });

  const onCommand = (clickEvent: Event) => {
    const currentButton = clickEvent.currentTarget as HTMLButtonElement | null;
    if (currentButton?.disabled) {
      return;
    }

    void deps.onCommand(event.reader.itemID).then(() => {
      void refresh();
    });
  };

  button?.addEventListener("click", onCommand);
  button?.addEventListener("command", onCommand);

  async function refresh(): Promise<void> {
    const currentButton = ensureButton(
      event.doc,
      deps.getLabel(),
      (...nodes) => {
        event.append(...nodes);
      },
    );
    if (!currentButton) {
      return;
    }

    const availability = await deps.getAvailability(event.reader.itemID);
    applyButtonState(currentButton, {
      disabled: !availability.canCopy,
      tooltipText: getToolbarTooltipText(deps.getLabel(), availability),
    });
  }

  return {
    refresh,
    dispose: () => {
      const currentButton = event.doc.getElementById(
        BUTTON_ID,
      ) as HTMLButtonElement | null;
      currentButton?.removeEventListener("click", onCommand);
      currentButton?.removeEventListener("command", onCommand);
      currentButton?.remove();
    },
  };
}

export function registerReaderToolbarButton(
  deps: ReaderToolbarRegistryDeps,
): () => void {
  const readerAPI = deps.readerAPI || (Zotero.Reader as ReaderToolbarAPI);
  const handles = new Map<Document, ReaderToolbarButtonHandle>();

  const render = (event: ReaderToolbarRenderEventLike) => {
    let handle = handles.get(event.doc);
    if (!handle) {
      handle = mountReaderToolbarButton(event, deps);
      handles.set(event.doc, handle);
    }

    void handle.refresh();
  };

  readerAPI.registerEventListener("renderToolbar", render, deps.pluginID);

  for (const reader of readerAPI._readers || []) {
    const doc = reader._iframeWindow?.document;
    if (!doc) {
      continue;
    }

    const handle = handles.get(doc);
    if (handle) {
      void handle.refresh();
      continue;
    }

    const mounted = mountReaderToolbarButton(
      {
        reader,
        doc,
        append: (...nodes) => {
          const container = doc.querySelector(VERIFIED_CONTAINER_SELECTOR);
          if (!container) {
            return;
          }
          container.append(...nodes);
        },
      },
      deps,
    );
    handles.set(doc, mounted);
    void mounted.refresh();
  }

  return () => {
    readerAPI.unregisterEventListener("renderToolbar", render);
    for (const handle of handles.values()) {
      handle.dispose();
    }
  };
}

function ensureButton(
  doc: Document,
  label: string,
  append: (...nodes: Node[]) => void,
): HTMLButtonElement | null {
  const existing = doc.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (existing) {
    return existing;
  }

  const button = createButton(doc, label);
  append(button);
  return button;
}

function createButton(doc: Document, label: string): HTMLButtonElement {
  const button = doc.createElement("button");
  button.id = BUTTON_ID;
  button.className = "toolbar-button zotclip-reader-toolbar-button";
  button.setAttribute("type", "button");
  button.setAttribute("aria-label", label);
  button.title = label;
  button.textContent = "";
  button.setAttribute(
    "style",
    [
      `background-image: url("${TOOLBAR_ICON_URL}")`,
      "background-position: center",
      "background-repeat: no-repeat",
      "background-size: 16px 16px",
      "width: 28px",
      "height: 28px",
      "min-width: 28px",
      "padding: 0",
    ].join("; "),
  );
  return button;
}

function applyButtonState(
  button: HTMLButtonElement,
  state: {
    disabled: boolean;
    tooltipText: string;
  },
): void {
  button.disabled = state.disabled;
  button.title = state.tooltipText;
  button.setAttribute("aria-label", state.tooltipText);
}
