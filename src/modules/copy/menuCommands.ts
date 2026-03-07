type CopyMenuLabelKey = "menu-copy-selected" | "menu-copy-reader";

export interface CopyMenuRegistrationDeps {
  addonRef: string;
  pluginID: string;
  menuIcon: string;
  getLabel(key: CopyMenuLabelKey): string;
  onCopySelection(): Promise<void>;
  onCopyReader(): Promise<void>;
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
  return [
    {
      menuID: `${deps.addonRef}-copy-selected`,
      pluginID: deps.pluginID,
      target: "main/library/item",
      menus: [
        createMenuItem(
          deps.getLabel("menu-copy-selected"),
          deps.menuIcon,
          deps.onCopySelection,
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
          deps.onCopyReader,
        ),
      ],
    },
  ];
}

function createMenuItem(
  label: string,
  icon: string,
  onCommand: () => Promise<void>,
): _ZoteroTypes.MenuManager.MenuData {
  return {
    menuType: "menuitem",
    icon,
    onShowing: (_event, context) => {
      context.menuElem.setAttribute("label", label);
      context.setIcon(icon);
    },
    onCommand: async () => {
      await onCommand();
    },
  };
}
