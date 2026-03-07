import assert from "node:assert/strict";
import test from "node:test";

import {
  registerCopyMenuCommands,
  unregisterCopyMenuCommands,
} from "../../src/modules/copy/menuCommands";

test("menu commands register library and tools menu entries with command handlers", async () => {
  const registrations: Array<_ZoteroTypes.MenuManager.AllMenuOptions> = [];
  let selectionCopyCount = 0;
  let readerCopyCount = 0;

  const registeredMenuIDs = registerCopyMenuCommands({
    addonRef: "zotclip",
    pluginID: "zotclip@cvrsg.dev",
    menuIcon: "chrome://zotclip/content/icons/favicon.svg",
    getLabel: (key) =>
      key === "menu-copy-selected"
        ? "Copy Attachment File(s)"
        : "Copy Current Reader Attachment",
    onCopySelection: async () => {
      selectionCopyCount += 1;
    },
    onCopyReader: async () => {
      readerCopyCount += 1;
    },
    registerMenu: (options) => {
      registrations.push(options);
      return options.menuID;
    },
  });

  assert.deepEqual(registeredMenuIDs, [
    "zotclip-copy-selected",
    "zotclip-copy-reader",
  ]);
  assert.deepEqual(
    registrations.map((registration) => registration.target),
    ["main/library/item", "main/menubar/tools"],
  );

  const itemContext = createMenuContext();
  registrations[0].menus[0].onShowing?.({} as Event, itemContext as any);
  await registrations[0].menus[0].onCommand?.({} as Event, itemContext as any);

  const toolsContext = createMenuContext();
  registrations[1].menus[0].onShowing?.({} as Event, toolsContext as any);
  await registrations[1].menus[0].onCommand?.({} as Event, toolsContext as any);

  assert.equal(itemContext.label, "Copy Attachment File(s)");
  assert.equal(toolsContext.label, "Copy Current Reader Attachment");
  assert.equal(itemContext.icon, "chrome://zotclip/content/icons/favicon.svg");
  assert.equal(toolsContext.icon, "chrome://zotclip/content/icons/favicon.svg");
  assert.equal(selectionCopyCount, 1);
  assert.equal(readerCopyCount, 1);
});

test("menu commands unregister every registered menu id", () => {
  const removedMenuIDs: string[] = [];

  unregisterCopyMenuCommands(["zotclip-copy-selected", "zotclip-copy-reader"], {
    unregisterMenu: (menuID) => {
      removedMenuIDs.push(menuID);
      return true;
    },
  });

  assert.deepEqual(removedMenuIDs, [
    "zotclip-copy-selected",
    "zotclip-copy-reader",
  ]);
});

function createMenuContext() {
  const menuElem = {
    attributes: new Map<string, string>(),
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    },
  };

  return {
    menuElem,
    label: "",
    icon: "",
    setL10nArgs() {
      return;
    },
    setEnabled() {
      return;
    },
    setVisible() {
      return;
    },
    setIcon(icon: string) {
      this.icon = icon;
    },
    get label() {
      return menuElem.attributes.get("label") || "";
    },
  };
}
