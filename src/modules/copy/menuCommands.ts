import type { CopyActionState } from "./interaction/actions/copyActionTypes";

type CopyMenuLabelKey =
  | "menu-copy-selected"
  | "menu-copy-reader"
  | "menu-copy-reader-path";

export interface CopyMenuRegistrationDeps {
  addonRef: string;
  pluginID: string;
  menuIcon: string;
  getLabel(key: CopyMenuLabelKey): string;
  getLibraryActionState(): Promise<CopyActionState>;
  getReaderActionState(): Promise<CopyActionState>;
  isContextMenuVisible?(): boolean;
  registerMenu?(
    options: _ZoteroTypes.MenuManager.AllMenuOptions,
  ): string | false;
}

export interface CopyMenuUnregisterDeps {
  unregisterMenu?(menuID: string): boolean;
}

export function registerCopyMenuCommands(
  deps: CopyMenuRegistrationDeps,
): string[] {
  const registerMenu =
    deps.registerMenu ||
    ((options) => Zotero.MenuManager.registerMenu(options));

  return buildCopyMenuOptions(deps)
    .map((options) => registerMenu(options))
    .filter((menuID): menuID is string => typeof menuID === "string");
}

export function unregisterCopyMenuCommands(
  menuIDs: string[],
  deps: CopyMenuUnregisterDeps = {},
): void {
  const unregisterMenu =
    deps.unregisterMenu ||
    ((menuID) => Zotero.MenuManager.unregisterMenu(menuID));

  for (const menuID of menuIDs) {
    unregisterMenu(menuID);
  }
}

function buildCopyMenuOptions(
  deps: CopyMenuRegistrationDeps,
): _ZoteroTypes.MenuManager.AllMenuOptions[] {
  const isContextMenuVisible = deps.isContextMenuVisible ?? (() => true);

  const options: _ZoteroTypes.MenuManager.AllMenuOptions[] = [
    {
      menuID: `${deps.addonRef}-copy-selected`,
      pluginID: deps.pluginID,
      target: "main/library/item",
      menus: [
        createMenuItem(
          deps.getLabel("menu-copy-selected"),
          deps.menuIcon,
          async () => {
            const state = await deps.getLibraryActionState();
            if (!state.primary.canExecute) {
              return;
            }

            await state.primary.run();
          },
          (_event, context) => {
            context.setVisible(isContextMenuVisible());
          },
        ),
      ],
    },
    {
      menuID: `${deps.addonRef}-copy-reader`,
      pluginID: deps.pluginID,
      target: "main/menubar/tools",
      menus: [
        createMenuItem(
          deps.getLabel("menu-copy-reader"),
          deps.menuIcon,
          async () => {
            const state = await deps.getReaderActionState();
            if (!state.primary.canExecute) {
              return;
            }

            await state.primary.run();
          },
        ),
      ],
    },
    {
      menuID: `${deps.addonRef}-copy-reader-path`,
      pluginID: deps.pluginID,
      target: "main/menubar/tools",
      menus: [
        createMenuItem(
          deps.getLabel("menu-copy-reader-path"),
          deps.menuIcon,
          async () => {
            const state = await deps.getReaderActionState();
            if (!state.secondary?.canExecute) {
              return;
            }

            await state.secondary.run();
          },
        ),
      ],
    },
  ];

  return options;
}

function createMenuItem(
  label: string,
  icon: string,
  onCommand: () => Promise<void>,
  beforeShowing?: (
    _event: any,
    context: _ZoteroTypes.MenuManager.BaseMenuContext,
  ) => void,
): _ZoteroTypes.MenuManager.MenuData {
  return {
    menuType: "menuitem",
    icon,
    onShowing: (_event, context) => {
      context.menuElem.setAttribute("label", label);
      context.setIcon(icon);
      beforeShowing?.(_event, context);
    },
    onCommand: async () => {
      await onCommand();
    },
  };
}
