import {
  copyFromReaderItem,
  copyFromSelection,
} from "./modules/copy/copyCommands";
import { copyFromReaderPath } from "./modules/copy/copyPathCommands";
import {
  buildUnavailableResult,
  checkReaderAvailability,
  checkSelectionAvailability,
} from "./modules/copy/copyService";
import { initToolbarIcon } from "./modules/copy/copyUi";
import {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./modules/copy/attachmentResolver";
import { createCopyActionController } from "./modules/copy/interaction/actions/copyActionController";
import type { CopyActionState } from "./modules/copy/interaction/actions/copyActionTypes";
import {
  buildLibraryRefreshKey,
  getSelectedLibraryItems,
} from "./modules/copy/interaction/context/libraryContext";
import { buildReaderRefreshKey } from "./modules/copy/interaction/readerContext";
import { getActiveReaderItemID } from "./modules/copy/zoteroReaderAccess";
import {
  registerMainToolbarButton,
  type MainToolbarButtonHandle,
} from "./modules/copy/mainToolbarButton";
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
import { registerPrefsScripts } from "./modules/preferenceScript";
import { getString, initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";
import { config } from "../package.json";

const menuIcon = `chrome://${config.addonRef}/content/icons/favicon.svg`;
const MAIN_TOOLBAR_REFRESH_DEBOUNCE_MS = 100;
const RUNTIME_SETTINGS_PREF_KEYS = [
  "multiAttachmentMode",
  "libraryShortcut",
  "readerShortcut",
  "showMainToolbarButton",
  "showReaderToolbarButton",
  "enabledAttachmentTypes",
  "customAttachmentTypes",
] as const;
let registeredCopyMenuIDs: string[] = [];
let runtimeSettingsPrefObservers: symbol[] = [];
let keyboardRegistryHandle: { dispose(): void } | undefined;
const runtimeSettings = getRuntimeSettingsStore();

export interface MainToolbarCopyButtonDeps {
  isEnabled(): boolean;
  mountButton(
    doc: Document,
    deps: Parameters<typeof registerMainToolbarButton>[1],
  ): MainToolbarButtonHandle;
  getActionState?(): Promise<CopyActionState>;
  getLabel(): string;
  getSelectedItems(win: Window): Zotero.Item[];
  getMode(): "all" | "primary";
  getAllowedTypes(): string[];
  resolveFromItems(
    items: Zotero.Item[],
    mode: "all" | "primary",
    allowedTypes: string[],
  ): Promise<Awaited<ReturnType<typeof resolveAttachmentsFromItems>>>;
  executeCopy(): Promise<Awaited<ReturnType<typeof copyFromSelection>>>;
}

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

export interface ReaderToolbarCopyButtonDeps {
  isEnabled(): boolean;
  registerButton(
    deps: Parameters<typeof registerReaderToolbarButton>[0],
  ): () => void;
  getActionState?(itemID: number | undefined): Promise<CopyActionState>;
  getLabel(): string;
  getAllowedTypes(): string[];
  resolveFromReader(
    itemID: number,
    allowedTypes: string[],
  ): Promise<Awaited<ReturnType<typeof resolveAttachmentFromReader>>>;
  executeCopy(
    itemID: number | undefined,
  ): Promise<Awaited<ReturnType<typeof copyFromReaderItem>>>;
  executeCopyPath(): Promise<Awaited<ReturnType<typeof copyFromReaderPath>>>;
}

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
  insertLocale: (win) => {
    win.MozXULElement.insertFTLIfNeeded(
      `${addon.data.config.addonRef}-mainWindow.ftl`,
    );
  },
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
        getActionState: createActiveLibraryActionState,
      }),
    onReaderShortcut: (event) =>
      handleReaderCopyShortcut(event, {
        getParsedShortcut: () =>
          runtimeSettings.getSnapshot().parsedReaderShortcut,
        getActionState: createActiveReaderActionState,
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
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.svg`,
  });
  registeredCopyMenuIDs = registerCopyMenuCommands({
    addonRef: addon.data.config.addonRef,
    pluginID: addon.data.config.addonID,
    menuIcon,
    getLabel: (key) => getString(key),
    getLibraryActionState: createActiveLibraryActionState,
    getReaderActionState: createActiveReaderActionState,
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
    case "load":
      registerPrefsScripts(data.window);
      break;
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

async function createActiveLibraryActionState(): Promise<CopyActionState> {
  const settings = runtimeSettings.getSnapshot();
  const getItems = () =>
    getSelectedLibraryItems({
      getActivePane: () => Zotero.getActiveZoteroPane(),
    });

  const controller = createCopyActionController({
    getAllowedTypes: () => settings.allowedTypes,
    getMode: () => settings.multiAttachmentMode,
    getLibraryItems: getItems,
    getReaderItemID: () => undefined,
    getSelectionAvailability: () =>
      checkSelectionAvailability(
        settings,
        getItems(),
        resolveAttachmentsFromItems,
      ),
    getReaderAvailability: async () => ({
      canCopy: false,
      messageKey: "copy-reader-no-active",
    }),
    executePrimaryLibraryCopy: async () => {
      const result = await copyFromSelection(
        settings.multiAttachmentMode,
        settings.allowedTypes,
      );
      notifyCopyResult(result);
      return result;
    },
    executePrimaryReaderCopy: async () =>
      buildUnavailableResult("copy-reader-no-active"),
    executeExplicitReaderPathCopy: async () =>
      buildUnavailableResult("copy-reader-no-active"),
  });

  return controller.getCurrentActionState();
}

async function createMainToolbarActionState(
  win: Window,
  deps: MainToolbarCopyButtonDeps,
): Promise<CopyActionState> {
  const controller = createCopyActionController({
    getAllowedTypes: () => deps.getAllowedTypes(),
    getMode: () => deps.getMode(),
    getLibraryItems: () => deps.getSelectedItems(win),
    getReaderItemID: () => undefined,
    getSelectionAvailability: () =>
      checkSelectionAvailability(
        {
          allowedTypes: deps.getAllowedTypes(),
          multiAttachmentMode: deps.getMode(),
        },
        deps.getSelectedItems(win),
        deps.resolveFromItems,
      ),
    getReaderAvailability: async () => ({
      canCopy: false,
      messageKey: "copy-reader-no-active",
    }),
    executePrimaryLibraryCopy: async () => deps.executeCopy(),
    executePrimaryReaderCopy: async () =>
      buildUnavailableResult("copy-reader-no-active"),
    executeExplicitReaderPathCopy: async () =>
      buildUnavailableResult("copy-reader-no-active"),
  });

  return controller.getCurrentActionState();
}

async function createActiveReaderActionState(): Promise<CopyActionState> {
  const settings = runtimeSettings.getSnapshot();
  const itemID = getActiveReaderItemID();

  const controller = createCopyActionController({
    getAllowedTypes: () => settings.allowedTypes,
    getMode: () => settings.multiAttachmentMode,
    getLibraryItems: () => [],
    getReaderItemID: () => itemID,
    getSelectionAvailability: async () => ({
      canCopy: false,
      messageKey: "copy-no-files",
    }),
    getReaderAvailability: () =>
      checkReaderAvailability(
        itemID,
        settings.allowedTypes,
        resolveAttachmentFromReader,
      ),
    executePrimaryLibraryCopy: async () =>
      buildUnavailableResult("copy-no-files"),
    executePrimaryReaderCopy: async () => {
      const result = await copyFromReaderItem(itemID, settings.allowedTypes);
      notifyCopyResult(result);
      return result;
    },
    executeExplicitReaderPathCopy: async () => executeCopyPathFromReader(),
  });

  return controller.getCurrentActionState();
}

async function createReaderToolbarActionState(
  itemID: number | undefined,
  deps: ReaderToolbarCopyButtonDeps,
): Promise<CopyActionState> {
  const controller = createCopyActionController({
    getAllowedTypes: () => deps.getAllowedTypes(),
    getMode: () => "all",
    getLibraryItems: () => [],
    getReaderItemID: () => itemID,
    getSelectionAvailability: async () => ({
      canCopy: false,
      messageKey: "copy-no-files",
    }),
    getReaderAvailability: () =>
      checkReaderAvailability(
        itemID,
        deps.getAllowedTypes(),
        deps.resolveFromReader,
      ),
    executePrimaryLibraryCopy: async () =>
      buildUnavailableResult("copy-no-files"),
    executePrimaryReaderCopy: async () => deps.executeCopy(itemID),
    executeExplicitReaderPathCopy: async () => deps.executeCopyPath(),
  });

  return controller.getCurrentActionState();
}

function syncMainToolbarButtons(): void {
  mainWindowController.syncMainToolbarButtons(Zotero.getMainWindows());
}

function syncReaderToolbarButton(): void {
  readerToolbarController.sync();
}

function registerToolbarPreferenceObservers(): void {
  runtimeSettingsPrefObservers = RUNTIME_SETTINGS_PREF_KEYS.map((key) =>
    Zotero.Prefs.registerObserver(
      `${config.prefsPrefix}.${key}`,
      () => {
        runtimeSettings.invalidate();
        syncMainToolbarButtons();
        syncReaderToolbarButton();
      },
      true,
    ),
  );
}

function unregisterToolbarPreferenceObservers(): void {
  for (const observer of runtimeSettingsPrefObservers) {
    Zotero.Prefs.unregisterObserver(observer);
  }
  runtimeSettingsPrefObservers = [];
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
