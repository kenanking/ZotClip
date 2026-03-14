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
import { createMainWindowController } from "./modules/copy/mainWindowController";
import { notifyCopyResult } from "./modules/copy/notifier";
import { registerReaderShortcutHandler } from "./modules/copy/readerHook";
import { registerReaderToolbarButton } from "./modules/copy/readerToolbarButton";
import { createReaderToolbarController } from "./modules/copy/readerToolbarController";
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

const menuIcon = `chrome://${config.addonRef}/content/icons/favicon.svg`;
let registeredCopyMenuIDs: string[] = [];
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

const mainWindowController = createMainWindowController({
  insertLocale: (win) => {
    win.MozXULElement.insertFTLIfNeeded(
      `${addon.data.config.addonRef}-mainWindow.ftl`,
    );
  },
  isMainToolbarButtonEnabled: () => getMainToolbarButtonEnabled(),
  registerReaderShortcutHandler: (win) =>
    registerReaderShortcutHandler(win, () => getReaderShortcut(), {
      triggerCopyFromReader: async () => {
        await executeCopyFromReader();
      },
    }),
  registerSelectionShortcutHandler: (win) =>
    registerSelectionShortcutHandler(win, {
      getShortcut: () => getLibraryShortcut(),
      triggerCopyFromSelection: async () => {
        await executeCopyFromSelection();
      },
    }),
  registerMainToolbarCopyButton: (win) => registerMainToolbarCopyButton(win),
});

const readerToolbarController = createReaderToolbarController({
  isEnabled: () => getReaderToolbarButtonEnabled(),
  registerReaderToolbarCopyButton: () => registerReaderToolbarCopyButton(),
});

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  addon.data.ztoolkit = addon.data.ztoolkit || createZToolkit();
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
  mainWindowController.load(win);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  mainWindowController.unload(win);
}

function onShutdown(): void {
  unregisterToolbarPreferenceObservers();
  readerToolbarController.dispose();
  mainWindowController.disposeAll(Zotero.getMainWindows());
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

function syncMainToolbarButtons(): void {
  mainWindowController.syncMainToolbarButtons(Zotero.getMainWindows());
}

function syncReaderToolbarButton(): void {
  readerToolbarController.sync();
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
