import { config } from "../../../package.json";
import { getToolbarIconDataURL, getToolbarTooltipText } from "./copyUi";
import type { CopyActionState } from "./interaction/actions/copyActionTypes";
import { buildActionTooltip } from "./interaction/presentation/copyActionMessages";
import { createAvailabilityCoordinator } from "./runtime/availabilityCoordinator";
import type { ClipboardResult } from "./types";
import { createReaderToolbarButtonElement } from "./ui/toolkitDom";

const BUTTON_ID = `${config.addonRef}-reader-copy-button`;
const FALLBACK_SECTION_ID = `${BUTTON_ID}-section`;
const CUSTOM_SECTIONS_SELECTOR = ".custom-sections";

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
  getRefreshKey?(itemID: number | undefined): string;
  getAvailability?(
    itemID: number | undefined,
  ): Promise<ReaderButtonAvailability>;
  onCommand?(itemID: number | undefined): Promise<void>;
  getActionState?(itemID: number | undefined): Promise<CopyActionState>;
  onActionComplete?(result: ClipboardResult): void;
  getActionTooltipText?(
    label: string,
    state: Pick<CopyActionState, "primary">,
  ): string;
  createButton?(input: {
    doc: Document;
    id: string;
    className: string;
    title: string;
    iconDataURL: string;
  }): HTMLButtonElement;
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
  const button = ensureButton(event.doc, deps, (...nodes) => {
    event.append(...nodes);
  });
  const availabilityCoordinator = createAvailabilityCoordinator();
  let currentActionState: CopyActionState | undefined;

  const onCommand = (clickEvent: Event) => {
    const currentButton = clickEvent.currentTarget as HTMLButtonElement | null;
    if (currentButton?.disabled) {
      return;
    }

    if (currentActionState) {
      void currentActionState.primary.run().then((result) => {
        deps.onActionComplete?.(result);
        availabilityCoordinator.notifyReaderCopyCompleted();
        void refresh();
      });
      return;
    }

    if (deps.onCommand) {
      void deps.onCommand(event.reader.itemID).then(() => {
        availabilityCoordinator.notifyReaderCopyCompleted();
        void refresh();
      });
    }
  };

  button?.addEventListener("click", onCommand);

  async function refresh(): Promise<void> {
    const refreshKey = deps.getRefreshKey?.(event.reader.itemID);
    if (refreshKey) {
      return availabilityCoordinator.requestReaderRefresh(
        refreshKey,
        refreshCurrentAvailability,
      );
    }

    return refreshCurrentAvailability();
  }

  async function refreshCurrentAvailability(): Promise<void> {
    const currentButton = ensureButton(
      event.doc,
      deps,
      (...nodes) => {
        event.append(...nodes);
      },
    );
    if (!currentButton) {
      return;
    }

    if (deps.getActionState) {
      currentActionState = await deps.getActionState(event.reader.itemID);
      applyButtonState(currentButton, {
        disabled: !currentActionState.primary.canExecute,
        tooltipText: (deps.getActionTooltipText || buildActionTooltip)(
          deps.getLabel(),
          currentActionState,
        ),
      });
      return;
    }

    const availability = await deps.getAvailability?.(event.reader.itemID);
    if (!availability) {
      return;
    }

    currentActionState = undefined;
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
          const section = ensureFallbackSection(doc);
          if (!section) {
            return;
          }
          section.append(...nodes);
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
  deps: ReaderToolbarButtonDeps,
  append: (...nodes: Node[]) => void,
): HTMLButtonElement | null {
  const existing = doc.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (existing) {
    return existing;
  }

  const button = createButton(doc, deps.getLabel(), deps.createButton);
  append(button);
  return button;
}

function createButton(
  doc: Document,
  label: string,
  createSharedButton:
    | ReaderToolbarButtonDeps["createButton"]
    | undefined,
): HTMLButtonElement {
  const iconDataURL = getToolbarIconDataURL();
  return (
    createSharedButton || createReaderToolbarButtonElement
  )({
    doc,
    id: BUTTON_ID,
    className: "toolbar-button zotclip-reader-toolbar-button",
    title: label,
    iconDataURL,
  });
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

function ensureFallbackSection(doc: Document): HTMLElement | null {
  const existing = doc.getElementById(
    FALLBACK_SECTION_ID,
  ) as HTMLElement | null;
  if (existing) {
    return existing;
  }

  const customSections = doc.querySelector(CUSTOM_SECTIONS_SELECTOR);
  if (!customSections) {
    return null;
  }

  const section = doc.createElement("div");
  section.id = FALLBACK_SECTION_ID;
  section.className = "section";
  customSections.append(section);
  return section;
}
