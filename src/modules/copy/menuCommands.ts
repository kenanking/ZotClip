import type { CopyActionState } from "./interaction/actions/copyActionTypes";

type CopyMenuLabelKey = "menu-auto-tag" | "menu-copy-selected";

export interface CopyMenuRegistrationDeps {
  addonRef: string;
  pluginID: string;
  menuIcon: string;
  getLabel(key: CopyMenuLabelKey): string;
  getLibraryActionState(): Promise<CopyActionState>;
  getReaderActionState(): Promise<CopyActionState>;
  isContextMenuVisible?(): boolean;
  isAutoTagEnabled?(): boolean;
  autoTagSelected?(): Promise<void>;
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
  const isAutoTagEnabled = deps.isAutoTagEnabled ?? (() => false);

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
      menuID: `${deps.addonRef}-auto-tag`,
      pluginID: deps.pluginID,
      target: "main/library/item",
      menus: [
        createMenuItem(
          deps.getLabel("menu-auto-tag"),
          deps.menuIcon,
          async () => {
            await deps.autoTagSelected?.();
          },
          (_event, context) => {
            context.setVisible(isAutoTagEnabled());
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
    _event: Event,
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
