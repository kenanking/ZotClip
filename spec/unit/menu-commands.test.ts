import test from "node:test";
import assertStrict from "node:assert/strict";

import {
  registerCopyMenuCommands,
  unregisterCopyMenuCommands,
} from "../../src/modules/copy/menuCommands";
import {
  createLibraryActionState,
  createReaderActionState,
} from "./fixtures/actionStateFixtures";

test("menu commands register library context menu entries with command handlers", async () => {
  const registrations: Array<_ZoteroTypes.MenuManager.AllMenuOptions> = [];
  let selectionCopyCount = 0;

  const registeredMenuIDs = registerCopyMenuCommands({
    addonRef: "zotclip",
    pluginID: "zotclip@cvrsg.dev",
    menuIcon: "chrome://zotclip/content/icons/favicon.svg",
    getLabel: (key) =>
      key === "menu-copy-selected"
        ? "Copy Attachment File(s)"
        : "Generate AI Tags",
    getLibraryActionState: async () =>
      createLibraryActionState({
        run: async () => {
          selectionCopyCount += 1;
          return { ok: true, format: "file-object", count: 1 };
        },
      }),
    getReaderActionState: async () => createReaderActionState(),
    registerMenu: (options) => {
      registrations.push(options);
      return options.menuID;
    },
  });

  assertStrict.deepEqual(registeredMenuIDs, [
    "zotclip-copy-selected",
    "zotclip-auto-tag",
  ]);
  assertStrict.deepEqual(
    registrations.map((registration) => registration.target),
    ["main/library/item", "main/library/item"],
  );

  const itemContext = createMenuContext();
  registrations[0].menus[0].onShowing?.({} as Event, itemContext as any);
  await registrations[0].menus[0].onCommand?.({} as Event, itemContext as any);

  assertStrict.equal(itemContext.label, "Copy Attachment File(s)");
  assertStrict.equal(
    itemContext.icon,
    "chrome://zotclip/content/icons/favicon.svg",
  );
  assertStrict.equal(selectionCopyCount, 1);
});

test("menu commands unregister every registered menu id", () => {
  const removedMenuIDs: string[] = [];

  unregisterCopyMenuCommands(["zotclip-copy-selected", "zotclip-auto-tag"], {
    unregisterMenu: (menuID) => {
      removedMenuIDs.push(menuID);
      return true;
    },
  });

  assertStrict.deepEqual(removedMenuIDs, [
    "zotclip-copy-selected",
    "zotclip-auto-tag",
  ]);
});

// Factories imported from shared fixtures — see fixtures/actionStateFixtures.ts

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
