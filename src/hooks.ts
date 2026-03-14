import {
  copyFromReader,
  copyFromReaderItem,
  copyFromSelection,
} from "./modules/copy/copyCommands";
import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./modules/copy/attachmentResolver";
import {
  registerMainToolbarButton,
  type MainToolbarButtonHandle,
} from "./modules/copy/mainToolbarButton";
import {
  registerCopyMenuCommands,
  unregisterCopyMenuCommands,
} from "./modules/copy/menuCommands";
import { notifyCopyResult } from "./modules/copy/notifier";
import { registerReaderShortcutHandler } from "./modules/copy/readerHook";
import { registerReaderToolbarButton } from "./modules/copy/readerToolbarButton";
import { registerSelectionShortcutHandler } from "./modules/copy/selectionHook";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { getString, initLocale } from "./utils/locale";
import {
  getAllowedAttachmentTypes,
  getLibraryShortcut,
  getMainToolbarButtonEnabled,
  getMultiAttachmentMode,
  getReaderShortcut,
  getReaderToolbarButtonEnabled,
} from "./utils/prefs";
import { createZToolkit } from "./utils/ztoolkit";
import { config } from "../package.json";

const readerHookDisposers = new WeakMap<Window, () => void>();
const mainToolbarDisposers = new WeakMap<Window, () => void>();
const selectionHookDisposers = new WeakMap<Window, () => void>();
const menuIcon = `chrome://${config.addonRef}/content/icons/favicon.svg`;
let registeredCopyMenuIDs: string[] = [];
let disposeReaderToolbarButton: (() => void) | null = null;
let mainToolbarPrefObserver: symbol | null = null;
let readerToolbarPrefObserver: symbol | null = null;

export interface MainToolbarCopyButtonDeps {
  isEnabled(): boolean;
  mountButton(
    doc: Document,
    deps: Parameters<typeof registerMainToolbarButton>[1],
  ): MainToolbarButtonHandle;
  getLabel(): string;
  getUnavailableMessage(): string;
  getSelectedItems(win: Window): Zotero.Item[];
  getMode(): "all" | "primary";
  getAllowedTypes(): string[];
  resolveFromItems(
    items: Zotero.Item[],
    mode: "all" | "primary",
    allowedTypes: string[],
  ): Promise<Awaited<ReturnType<typeof resolveAttachmentsFromItems>>>;
  executeCopy(): Promise<void>;
}

const DEFAULT_MAIN_TOOLBAR_COPY_BUTTON_DEPS: MainToolbarCopyButtonDeps = {
  isEnabled: () => getMainToolbarButtonEnabled(),
  mountButton: (doc, deps) => registerMainToolbarButton(doc, deps),
  getLabel: () => getString("mainwindow-copy-toolbar"),
  getUnavailableMessage: () =>
    getString("mainwindow-copy-selected-unavailable"),
  getSelectedItems: (win) =>
    ((win as _ZoteroTypes.MainWindow).ZoteroPane?.getSelectedItems?.() ||
      []) as Zotero.Item[],
  getMode: () => getMultiAttachmentMode(),
  getAllowedTypes: () => getAllowedAttachmentTypes(),
  resolveFromItems: (items, mode, allowedTypes) =>
    resolveAttachmentsFromItems(items, mode, allowedTypes),
  executeCopy: async () => {
    await executeCopyFromSelection();
  },
};

export interface ReaderToolbarCopyButtonDeps {
  isEnabled(): boolean;
  registerButton(
    deps: Parameters<typeof registerReaderToolbarButton>[0],
  ): () => void;
  getLabel(): string;
  getNoActiveMessage(): string;
  getUnavailableMessage(): string;
  getAllowedTypes(): string[];
  resolveFromReader(
    itemID: number,
    allowedTypes: string[],
  ): Promise<Awaited<ReturnType<typeof resolveAttachmentFromReader>>>;
  executeCopy(itemID: number | undefined): Promise<void>;
}

const DEFAULT_READER_TOOLBAR_COPY_BUTTON_DEPS: ReaderToolbarCopyButtonDeps = {
  isEnabled: () => getReaderToolbarButtonEnabled(),
  registerButton: (deps) =>
    registerReaderToolbarButton({
      ...deps,
      pluginID: addon.data.config.addonID,
    }),
  getLabel: () => getString("mainwindow-copy-toolbar"),
  getNoActiveMessage: () => getString("mainwindow-copy-reader-no-active"),
  getUnavailableMessage: () => getString("mainwindow-copy-reader-unavailable"),
  getAllowedTypes: () => getAllowedAttachmentTypes(),
  resolveFromReader: (itemID, allowedTypes) =>
    resolveAttachmentFromReader(itemID, allowedTypes),
  executeCopy: async (itemID) => {
    await executeCopyFromReaderItem(itemID);
  },
};

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`,
  });
  registeredCopyMenuIDs = registerCopyMenuCommands({
    addonRef: addon.data.config.addonRef,
    pluginID: addon.data.config.addonID,
    menuIcon,
    getLabel: (key) => getString(key),
    onCopySelection: executeCopyFromSelection,
    onCopyReader: executeCopyFromReader,
  });

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );
  registerToolbarPreferenceObservers();
  syncMainToolbarButtons();
  syncReaderToolbarButton();

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  const disposeReaderHook = registerReaderShortcutHandler(
    win,
    () => getReaderShortcut(),
    {
      triggerCopyFromReader: async () => {
        await executeCopyFromReader();
      },
    },
  );
  readerHookDisposers.set(win, disposeReaderHook);

  if (getMainToolbarButtonEnabled()) {
    const disposeMainToolbar = registerMainToolbarCopyButton(win);
    mainToolbarDisposers.set(win, disposeMainToolbar);
  }

  const disposeSelectionHook = registerSelectionShortcutHandler(win, {
    getShortcut: () => getLibraryShortcut(),
    triggerCopyFromSelection: async () => {
      await executeCopyFromSelection();
    },
  });
  selectionHookDisposers.set(win, disposeSelectionHook);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  readerHookDisposers.get(win)?.();
  readerHookDisposers.delete(win);
  mainToolbarDisposers.get(win)?.();
  mainToolbarDisposers.delete(win);
  selectionHookDisposers.get(win)?.();
  selectionHookDisposers.delete(win);
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  unregisterToolbarPreferenceObservers();
  disposeReaderToolbarButton?.();
  disposeReaderToolbarButton = null;
  for (const win of Zotero.getMainWindows()) {
    readerHookDisposers.get(win)?.();
    readerHookDisposers.delete(win);
    mainToolbarDisposers.get(win)?.();
    mainToolbarDisposers.delete(win);
    selectionHookDisposers.get(win)?.();
    selectionHookDisposers.delete(win);
  }
  unregisterCopyMenuCommands(registeredCopyMenuIDs);
  registeredCopyMenuIDs = [];
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  _event: string,
  _type: string,
  _ids: Array<string | number>,
  _extraData: { [key: string]: any },
) {
  return;
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function onShortcuts(_type: string) {
  return;
}

function onDialogEvents(_type: string) {
  return;
}

export function registerMainToolbarCopyButton(
  win: Window,
  deps: MainToolbarCopyButtonDeps = DEFAULT_MAIN_TOOLBAR_COPY_BUTTON_DEPS,
): () => void {
  if (!deps.isEnabled()) {
    return () => {};
  }

  const buttonHandle = deps.mountButton(win.document, {
    getLabel: () => deps.getLabel(),
    getAvailability: async () => {
      const items = deps.getSelectedItems(win);
      const files = await deps.resolveFromItems(
        items,
        deps.getMode(),
        deps.getAllowedTypes(),
      );

      if (!files.length) {
        return {
          canCopy: false,
          unavailableMessage: deps.getUnavailableMessage(),
        };
      }

      return {
        canCopy: true,
      };
    },
    onCommand: async () => {
      await deps.executeCopy();
    },
  });

  const refresh = () => {
    void buttonHandle.refresh();
  };

  win.addEventListener("focus", refresh, true);
  win.addEventListener("pageshow", refresh, true);
  win.document.addEventListener("focusin", refresh, true);
  void buttonHandle.refresh();

  return () => {
    win.removeEventListener("focus", refresh, true);
    win.removeEventListener("pageshow", refresh, true);
    win.document.removeEventListener("focusin", refresh, true);
    buttonHandle.dispose();
  };
}

export function registerReaderToolbarCopyButton(
  deps: ReaderToolbarCopyButtonDeps = DEFAULT_READER_TOOLBAR_COPY_BUTTON_DEPS,
): () => void {
  if (!deps.isEnabled()) {
    return () => {};
  }

  return deps.registerButton({
    getLabel: () => deps.getLabel(),
    getAvailability: async (itemID) => {
      if (!itemID) {
        return {
          canCopy: false,
          unavailableMessage: deps.getNoActiveMessage(),
        };
      }

      const files = await deps.resolveFromReader(
        itemID,
        deps.getAllowedTypes(),
      );
      if (!files.length) {
        return {
          canCopy: false,
          unavailableMessage: deps.getUnavailableMessage(),
        };
      }

      return {
        canCopy: true,
      };
    },
    onCommand: async (itemID) => {
      await deps.executeCopy(itemID);
    },
  });
}

async function executeCopyFromSelection(): Promise<void> {
  const result = await copyFromSelection(
    getMultiAttachmentMode(),
    getAllowedAttachmentTypes(),
  );
  notifyCopyResult(result);
}

async function executeCopyFromReader(): Promise<void> {
  const result = await copyFromReader(getAllowedAttachmentTypes());
  notifyCopyResult(result);
}

async function executeCopyFromReaderItem(
  itemID: number | undefined,
): Promise<void> {
  const result = await copyFromReaderItem(itemID, getAllowedAttachmentTypes());
  notifyCopyResult(result);
}

function getCurrentReaderItemID(): number | undefined {
  const tabs = ztoolkit.getGlobal("Zotero_Tabs") as {
    selectedID?: string;
  };
  const selectedTabID = tabs?.selectedID;
  if (!selectedTabID) {
    return undefined;
  }

  return Zotero.Reader.getByTabID(selectedTabID)?.itemID;
}

function syncMainToolbarButtons(): void {
  const enabled = getMainToolbarButtonEnabled();

  for (const win of Zotero.getMainWindows()) {
    const existing = mainToolbarDisposers.get(win);

    if (enabled && !existing) {
      mainToolbarDisposers.set(win, registerMainToolbarCopyButton(win));
      continue;
    }

    if (!enabled && existing) {
      existing();
      mainToolbarDisposers.delete(win);
    }
  }
}

function syncReaderToolbarButton(): void {
  const enabled = getReaderToolbarButtonEnabled();

  if (enabled) {
    disposeReaderToolbarButton ||= registerReaderToolbarCopyButton();
    return;
  }

  disposeReaderToolbarButton?.();
  disposeReaderToolbarButton = null;
}

function registerToolbarPreferenceObservers(): void {
  mainToolbarPrefObserver = Zotero.Prefs.registerObserver(
    `${config.prefsPrefix}.showMainToolbarButton`,
    () => {
      syncMainToolbarButtons();
    },
    true,
  );
  readerToolbarPrefObserver = Zotero.Prefs.registerObserver(
    `${config.prefsPrefix}.showReaderToolbarButton`,
    () => {
      syncReaderToolbarButton();
    },
    true,
  );
}

function unregisterToolbarPreferenceObservers(): void {
  if (mainToolbarPrefObserver) {
    Zotero.Prefs.unregisterObserver(mainToolbarPrefObserver);
    mainToolbarPrefObserver = null;
  }

  if (readerToolbarPrefObserver) {
    Zotero.Prefs.unregisterObserver(readerToolbarPrefObserver);
    readerToolbarPrefObserver = null;
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
