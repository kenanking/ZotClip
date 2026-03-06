import { copyFromReader, copyFromSelection } from "./modules/copy/copyCommands";
import { notifyCopyResult } from "./modules/copy/notifier";
import { registerReaderShortcutHandler } from "./modules/copy/readerHook";
import { registerSelectionShortcutHandler } from "./modules/copy/selectionHook";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { getString, initLocale } from "./utils/locale";
import {
  getAllowedAttachmentTypes,
  getMultiAttachmentMode,
  getReaderCtrlCMode,
} from "./utils/prefs";
import { createZToolkit } from "./utils/ztoolkit";
import { config } from "../package.json";

const readerHookDisposers = new WeakMap<Window, () => void>();
const selectionHookDisposers = new WeakMap<Window, () => void>();
const menuIcon = `chrome://${config.addonRef}/content/icons/favicon.svg`;

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

  registerCopyMenuCommands();

  const disposeReaderHook = registerReaderShortcutHandler(
    win,
    () => getReaderCtrlCMode(),
    {
      triggerCopyFromReader: async () => {
        await executeCopyFromReader();
      },
    },
  );
  readerHookDisposers.set(win, disposeReaderHook);

  const disposeSelectionHook = registerSelectionShortcutHandler(win, {
    triggerCopyFromSelection: async () => {
      await executeCopyFromSelection();
    },
  });
  selectionHookDisposers.set(win, disposeSelectionHook);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  readerHookDisposers.get(win)?.();
  readerHookDisposers.delete(win);
  selectionHookDisposers.get(win)?.();
  selectionHookDisposers.delete(win);
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
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

function registerCopyMenuCommands() {
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: `zotero-itemmenu-${addon.data.config.addonRef}-copy-selected`,
    label: getString("menu-copy-selected"),
    icon: menuIcon,
    commandListener: () => {
      void executeCopyFromSelection();
    },
  });

  ztoolkit.Menu.register("menuTools", {
    tag: "menuitem",
    id: `zotero-toolsmenu-${addon.data.config.addonRef}-copy-reader`,
    label: getString("menu-copy-reader"),
    icon: menuIcon,
    commandListener: () => {
      void executeCopyFromReader();
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
