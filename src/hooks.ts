import { copyFromReader, copyFromSelection } from "./modules/copy/copyCommands";
import { resolveAttachmentFromReader } from "./modules/copy/attachmentResolver";
import {
  registerCopyMenuCommands,
  unregisterCopyMenuCommands,
} from "./modules/copy/menuCommands";
import { notifyCopyResult } from "./modules/copy/notifier";
import { registerReaderShortcutHandler } from "./modules/copy/readerHook";
import {
  registerReaderToolbarButton,
  type ReaderButtonAvailability,
} from "./modules/copy/readerToolbarButton";
import { registerSelectionShortcutHandler } from "./modules/copy/selectionHook";
import { formatShortcut, parseShortcut } from "./modules/copy/shortcuts";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { getString, initLocale } from "./utils/locale";
import {
  getAllowedAttachmentTypes,
  getLibraryShortcut,
  getMultiAttachmentMode,
  getReaderShortcut,
} from "./utils/prefs";
import { createZToolkit } from "./utils/ztoolkit";
import { config } from "../package.json";

const readerHookDisposers = new WeakMap<Window, () => void>();
const readerToolbarDisposers = new WeakMap<Window, () => void>();
const selectionHookDisposers = new WeakMap<Window, () => void>();
const menuIcon = `chrome://${config.addonRef}/content/icons/favicon.svg`;
let registeredCopyMenuIDs: string[] = [];

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

  const disposeReaderToolbar = registerReaderToolbarButton(win, {
    getLabel: () => getString("mainwindow-copy-reader"),
    getShortcutLabel: () => formatShortcut(parseShortcut(getReaderShortcut())),
    getAvailability: async () => getReaderButtonAvailability(),
    onCommand: async () => {
      await executeCopyFromReader();
    },
  });
  readerToolbarDisposers.set(win, disposeReaderToolbar);

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
  readerToolbarDisposers.get(win)?.();
  readerToolbarDisposers.delete(win);
  selectionHookDisposers.get(win)?.();
  selectionHookDisposers.delete(win);
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
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

async function getReaderButtonAvailability(): Promise<ReaderButtonAvailability> {
  const readerItemID = getCurrentReaderItemID();
  if (!readerItemID) {
    return {
      canCopy: false,
      unavailableMessage: getString("mainwindow-copy-reader-no-active"),
    };
  }

  const files = await resolveAttachmentFromReader(
    readerItemID,
    getAllowedAttachmentTypes(),
  );

  if (!files.length) {
    return {
      canCopy: false,
      unavailableMessage: getString("mainwindow-copy-reader-unavailable"),
    };
  }

  return {
    canCopy: true,
  };
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
