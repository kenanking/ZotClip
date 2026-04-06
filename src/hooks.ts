import {
  copyFromReaderItem,
  copyFromSelection,
} from "./modules/copy/copyCommands";
import { copyFromReaderPath } from "./modules/copy/copyPathCommands";
import { initToolbarIcon } from "./modules/copy/copyUi";
import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./modules/copy/attachmentResolver";
import { buildLibraryRefreshKey } from "./modules/copy/interaction/context/libraryContext";
import { buildReaderRefreshKey } from "./modules/copy/interaction/readerContext";
import { registerMainToolbarButton } from "./modules/copy/mainToolbarButton";
import {
  registerCopyMenuCommands,
  unregisterCopyMenuCommands,
} from "./modules/copy/menuCommands";
import { createKeyboardRegistry } from "./modules/copy/interaction/keyboardRegistry";
import { createMainWindowController } from "./modules/copy/mainWindowController";
import { notifyCopyResult } from "./modules/copy/notifier";
import { handleReaderCopyShortcut } from "./modules/copy/readerHook";
import { registerReaderToolbarButton } from "./modules/copy/readerToolbarButton";
import { createReaderToolbarController } from "./modules/copy/readerToolbarController";
import { getRuntimeSettingsStore } from "./modules/copy/runtime/runtimeSettings";
import { handleSelectionCopyShortcut } from "./modules/copy/selectionHook";
import { registerPrefsUI } from "./modules/copy/preferences/registerPrefsUI";
import {
  createActiveLibraryActionState,
  createActiveReaderActionState,
  createMainToolbarActionState,
  createReaderToolbarActionState,
} from "./modules/copy/actionStateFactory";
import type {
  MainToolbarCopyButtonDeps,
  ReaderToolbarCopyButtonDeps,
} from "./modules/copy/toolbarButtonDeps";
import {
  registerToolbarPreferenceObservers,
  unregisterToolbarPreferenceObservers,
} from "./modules/copy/toolbarSync";
import { registerAutoTagItemAddObserver } from "./modules/tagging/integration/itemAddAutoTagObserver";
import { executeAutoTagSelection } from "./modules/tagging/integration/manualAutoTagSelection";
import {
  getContextMenuEntryEnabled,
  getAutoTaggingEnabled,
} from "./utils/prefs";
import { getAddonFaviconUri } from "./utils/addonAssets";
import { getString, initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";

const menuIcon = getAddonFaviconUri();
const MAIN_TOOLBAR_REFRESH_DEBOUNCE_MS = 100;
let registeredCopyMenuIDs: string[] = [];
let runtimeSettingsPrefObservers: symbol[] = [];
let keyboardRegistryHandle: { dispose(): void } | undefined;
let autoTagItemAddHandle: { dispose(): void } | undefined;
const runtimeSettings = getRuntimeSettingsStore();

const DEFAULT_MAIN_TOOLBAR_COPY_BUTTON_DEPS: MainToolbarCopyButtonDeps = {
  isEnabled: () => runtimeSettings.getSnapshot().showMainToolbarButton,
  mountButton: (doc, deps) => registerMainToolbarButton(doc, deps),
  getLabel: () => getString("mainwindow-copy-toolbar"),
  getSelectedItems: (win) =>
    ((win as _ZoteroTypes.MainWindow).ZoteroPane?.getSelectedItems?.() ||
      []) as Zotero.Item[],
  getMode: () => runtimeSettings.getSnapshot().multiAttachmentMode,
  getAllowedTypes: () => runtimeSettings.getSnapshot().allowedTypes,
  resolveFromItems: (items, mode, allowedTypes) =>
    resolveAttachmentsFromItems(items, mode, allowedTypes),
  executeCopy: async () => executeCopyFromSelection(),
};

const DEFAULT_READER_TOOLBAR_COPY_BUTTON_DEPS: ReaderToolbarCopyButtonDeps = {
  isEnabled: () => runtimeSettings.getSnapshot().showReaderToolbarButton,
  registerButton: (deps) =>
    registerReaderToolbarButton({
      ...deps,
      pluginID: addon.data.config.addonID,
    }),
  getLabel: () => getString("mainwindow-copy-toolbar"),
  getAllowedTypes: () => runtimeSettings.getSnapshot().allowedTypes,
  resolveFromReader: (itemID, allowedTypes) =>
    resolveAttachmentFromReader(itemID, allowedTypes),
  executeCopy: async (itemID) => executeCopyFromReaderItem(itemID),
  executeCopyPath: async () => executeCopyPathFromReader(),
};

const mainWindowController = createMainWindowController({
  isMainToolbarButtonEnabled: () =>
    runtimeSettings.getSnapshot().showMainToolbarButton,
  registerMainToolbarCopyButton: (win) => registerMainToolbarCopyButton(win),
});

const readerToolbarController = createReaderToolbarController({
  isEnabled: () => runtimeSettings.getSnapshot().showReaderToolbarButton,
  registerReaderToolbarCopyButton: () => registerReaderToolbarCopyButton(),
});

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  addon.data.ztoolkit = addon.data.ztoolkit || createZToolkit();
  keyboardRegistryHandle = createKeyboardRegistry({
    register: (callback) => ztoolkit.Keyboard.register(callback),
    unregister: (callback) => ztoolkit.Keyboard.unregister(callback),
    onLibraryShortcut: (event) =>
      handleSelectionCopyShortcut(event, {
        getParsedShortcut: () =>
          runtimeSettings.getSnapshot().parsedLibraryShortcut,
        getActionState: () =>
          createActiveLibraryActionState(runtimeSettings.getSnapshot()),
      }),
    onReaderShortcut: (event) =>
      handleReaderCopyShortcut(event, {
        getParsedShortcut: () =>
          runtimeSettings.getSnapshot().parsedReaderShortcut,
        getActionState: () =>
          createActiveReaderActionState(runtimeSettings.getSnapshot()),
      }),
  }).start();
  initLocale();
  try {
    await initToolbarIcon();
  } catch (error) {
    Zotero.logError(error instanceof Error ? error : new Error(String(error)));
  }
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: getAddonFaviconUri(),
  });
  registeredCopyMenuIDs = registerCopyMenuCommands({
    addonRef: addon.data.config.addonRef,
    pluginID: addon.data.config.addonID,
    menuIcon,
    getLabel: (key) => getString(key),
    getLibraryActionState: () =>
      createActiveLibraryActionState(runtimeSettings.getSnapshot()),
    getReaderActionState: () =>
      createActiveReaderActionState(runtimeSettings.getSnapshot()),
    isContextMenuVisible: () => getContextMenuEntryEnabled(),
    isAutoTagEnabled: () => getAutoTaggingEnabled(),
    autoTagSelected: () => executeAutoTagSelection(),
  });

  autoTagItemAddHandle = registerAutoTagItemAddObserver();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );
  runtimeSettingsPrefObservers = registerToolbarPreferenceObservers(
    runtimeSettings,
    syncMainToolbarButtons,
    syncReaderToolbarButton,
  );
  syncMainToolbarButtons();
  syncReaderToolbarButton();
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  mainWindowController.load(win);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  mainWindowController.unload(win);
}

function onShutdown(): void {
  autoTagItemAddHandle?.dispose();
  autoTagItemAddHandle = undefined;
  unregisterToolbarPreferenceObservers(runtimeSettingsPrefObservers);
  runtimeSettingsPrefObservers = [];
  keyboardRegistryHandle?.dispose();
  keyboardRegistryHandle = undefined;
  readerToolbarController.dispose();
  mainWindowController.disposeAll(Zotero.getMainWindows());
  unregisterCopyMenuCommands(registeredCopyMenuIDs);
  registeredCopyMenuIDs = [];
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load": {
      registerPrefsUI(data.window);
      break;
    }
    default:
      return;
  }
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
    getRefreshKey: () => buildSelectionRefreshKeyFromDeps(win, deps),
    getActionState: deps.getActionState
      ? deps.getActionState
      : async () => createMainToolbarActionState(win, deps),
  });

  const requestRefresh = () => {
    void buttonHandle.refresh();
  };
  const debouncedRefresh = createDebouncedCallback(
    requestRefresh,
    MAIN_TOOLBAR_REFRESH_DEBOUNCE_MS,
  );

  win.addEventListener("focus", debouncedRefresh.trigger, true);
  win.addEventListener("mouseup", debouncedRefresh.trigger, true);
  win.addEventListener("keyup", debouncedRefresh.trigger, true);
  void buttonHandle.refresh();

  return () => {
    win.removeEventListener("focus", debouncedRefresh.trigger, true);
    win.removeEventListener("mouseup", debouncedRefresh.trigger, true);
    win.removeEventListener("keyup", debouncedRefresh.trigger, true);
    debouncedRefresh.cancel();
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
    getRefreshKey: (itemID) => buildReaderRefreshKeyFromDeps(itemID, deps),
    getActionState: deps.getActionState
      ? deps.getActionState
      : async (itemID) => createReaderToolbarActionState(itemID, deps),
  });
}

async function executeCopyFromSelection(): Promise<
  Awaited<ReturnType<typeof copyFromSelection>>
> {
  const settings = runtimeSettings.getSnapshot();
  const result = await copyFromSelection(
    settings.multiAttachmentMode,
    settings.allowedTypes,
  );
  notifyCopyResult(result);
  return result;
}

async function executeCopyFromReaderItem(
  itemID: number | undefined,
): Promise<Awaited<ReturnType<typeof copyFromReaderItem>>> {
  const result = await copyFromReaderItem(
    itemID,
    runtimeSettings.getSnapshot().allowedTypes,
  );
  notifyCopyResult(result);
  return result;
}

async function executeCopyPathFromReader(): Promise<
  Awaited<ReturnType<typeof copyFromReaderPath>>
> {
  const result = await copyFromReaderPath(
    runtimeSettings.getSnapshot().allowedTypes,
  );
  notifyCopyResult(result);
  return result;
}

function syncMainToolbarButtons(): void {
  mainWindowController.syncMainToolbarButtons(Zotero.getMainWindows());
}

function syncReaderToolbarButton(): void {
  readerToolbarController.sync();
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
};

function buildSelectionRefreshKeyFromDeps(
  win: Window,
  deps: MainToolbarCopyButtonDeps,
): string {
  return buildLibraryRefreshKey({
    mode: deps.getMode(),
    allowedTypes: deps.getAllowedTypes(),
    items: deps.getSelectedItems(win),
  });
}

function buildReaderRefreshKeyFromDeps(
  itemID: number | undefined,
  deps: ReaderToolbarCopyButtonDeps,
): string {
  return buildReaderRefreshKey(itemID, deps.getAllowedTypes());
}

function createDebouncedCallback(
  callback: () => void,
  delayMs: number,
): {
  trigger(): void;
  cancel(): void;
} {
  let timeoutID: ReturnType<typeof setTimeout> | undefined;

  return {
    trigger(): void {
      if (timeoutID !== undefined) {
        clearTimeout(timeoutID);
      }

      timeoutID = setTimeout(() => {
        timeoutID = undefined;
        callback();
      }, delayMs);
    },
    cancel(): void {
      if (timeoutID === undefined) {
        return;
      }

      clearTimeout(timeoutID);
      timeoutID = undefined;
    },
  };
}
