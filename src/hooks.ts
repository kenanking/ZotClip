import {
  executeCopyFromSelection,
  executeCopyFromReaderItem,
} from "./execution/copyActions";
import { initToolbarIcon } from "./modules/copy/copyUi";
import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./modules/copy/attachmentResolver";
import { registerMainToolbarButton } from "./modules/copy/mainToolbarButton";
import {
  registerCopyMenuCommands,
  unregisterCopyMenuCommands,
} from "./modules/copy/menuCommands";
import { createKeyboardRegistry } from "./modules/copy/interaction/keyboardRegistry";
import { registerReaderToolbarButton } from "./modules/copy/readerToolbarButton";
import { createMainWindowController } from "./modules/copy/mainWindowController";
import { handleReaderCopyShortcut } from "./modules/copy/readerHook";
import { createReaderToolbarController } from "./modules/copy/readerToolbarController";
import { getRuntimeSettingsStore } from "./modules/copy/runtime/runtimeSettings";
import { handleSelectionCopyShortcut } from "./modules/copy/selectionHook";
import { registerPrefsUI } from "./modules/copy/preferences/registerPrefsUI";
import {
  createActiveLibraryActionState,
  createActiveReaderActionState,
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
import {
  registerMainToolbarCopyButton,
  registerReaderToolbarCopyButton,
} from "./toolbar/buttonRegistration";

const menuIcon = getAddonFaviconUri();
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
  executeCopy: async () =>
    executeCopyFromSelection(runtimeSettings.getSnapshot()),
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
  executeCopy: async (itemID) =>
    executeCopyFromReaderItem(itemID, runtimeSettings.getSnapshot()),
};

const mainWindowController = createMainWindowController({
  isMainToolbarButtonEnabled: () =>
    runtimeSettings.getSnapshot().showMainToolbarButton,
  registerMainToolbarCopyButton: (win) =>
    registerMainToolbarCopyButton(win, DEFAULT_MAIN_TOOLBAR_COPY_BUTTON_DEPS),
});

const readerToolbarController = createReaderToolbarController({
  isEnabled: () => runtimeSettings.getSnapshot().showReaderToolbarButton,
  registerReaderToolbarCopyButton: () =>
    registerReaderToolbarCopyButton(DEFAULT_READER_TOOLBAR_COPY_BUTTON_DEPS),
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
