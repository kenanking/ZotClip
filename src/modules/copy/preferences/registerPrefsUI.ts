import { getMultiAttachmentMode } from "../../../utils/prefs";
import { registerAttachmentTypesSection } from "./attachmentTypesSection";
import { registerDiagnosticsSection } from "./diagnosticsSection";
import { registerInterfaceSection } from "./interfaceSection";
import { registerShortcutsSection } from "./shortcutsSection";
import { composeDisposables, createNoopHandle } from "../ui/disposables";

interface MenuitemLike {
  value?: string;
  getAttribute?: (name: string) => string | null;
}

interface MenulistLike {
  value: string;
  selectedItem?: MenuitemLike | null;
  querySelectorAll: (selector: string) => Iterable<MenuitemLike>;
  addEventListener?: (type: string, listener: () => void) => void;
}

export interface PrefsUIHandle {
  dispose(): void;
}

export interface RegisterPrefsUIDeps {
  syncPreferenceMenulists?(doc: Document): void;
  registerAttachmentTypesSection?(
    doc: Document,
  ): Promise<PrefsUIHandle> | PrefsUIHandle;
  registerInterfaceSection?(
    doc: Document,
  ): Promise<PrefsUIHandle> | PrefsUIHandle;
  registerShortcutsSection?(
    doc: Document,
  ): Promise<PrefsUIHandle> | PrefsUIHandle;
  registerDiagnosticsSection?(
    doc: Document,
  ): Promise<PrefsUIHandle> | PrefsUIHandle;
}

const windowHandles = new WeakMap<Window, PrefsUIHandle>();

const DEFAULT_DEPS: RegisterPrefsUIDeps = {
  syncPreferenceMenulists: (doc) => syncPreferenceMenulists(doc),
  registerAttachmentTypesSection: (doc) => registerAttachmentTypesSection(doc),
  registerInterfaceSection: (doc) => registerInterfaceSection(doc),
  registerShortcutsSection: (doc) => registerShortcutsSection(doc),
  registerDiagnosticsSection: (doc) => registerDiagnosticsSection(doc),
};

export async function registerPrefsUI(
  window: Window,
  deps: RegisterPrefsUIDeps = DEFAULT_DEPS,
): Promise<PrefsUIHandle> {
  windowHandles.get(window)?.dispose();
  deps.syncPreferenceMenulists?.(window.document);

  const sectionHandles = await Promise.all([
    deps.registerAttachmentTypesSection?.(window.document) ||
      createNoopHandle(),
    deps.registerInterfaceSection?.(window.document) || createNoopHandle(),
    deps.registerShortcutsSection?.(window.document) || createNoopHandle(),
    deps.registerDiagnosticsSection?.(window.document) || createNoopHandle(),
  ]);

  const handle = composeDisposables(
    ...sectionHandles.map((sectionHandle) => () => sectionHandle.dispose()),
    () => {
      if (windowHandles.get(window) === handle) {
        windowHandles.delete(window);
      }
    },
  ) as PrefsUIHandle;

  windowHandles.set(window, handle);
  return handle;
}

function syncPreferenceMenulists(doc: Document): void {
  registerMenulistSync(
    doc.getElementById(
      "zotero-prefpane-__addonRef__-multi-attachment-mode",
    ) as MenulistLike | null,
    getMultiAttachmentMode(),
  );
}

function registerMenulistSync(
  menulist: MenulistLike | null,
  preferredValue: string,
): void {
  if (!menulist) {
    return;
  }

  syncMenulistValue(menulist, preferredValue);
  menulist.addEventListener?.("command", () => {
    syncMenulistValue(menulist, getMenulistCurrentValue(menulist));
  });
}

function syncMenulistValue(
  menulist: MenulistLike,
  preferredValue: string,
): string {
  const items = Array.from(menulist.querySelectorAll("menuitem"));
  const nextItem =
    items.find((item) => getMenuitemValue(item) === preferredValue) ||
    items[0] ||
    null;
  const nextValue = getMenuitemValue(nextItem) || preferredValue;
  menulist.value = nextValue;
  menulist.selectedItem = nextItem;
  return nextValue;
}

function getMenulistCurrentValue(menulist: MenulistLike): string {
  return menulist.value || getMenuitemValue(menulist.selectedItem || null);
}

function getMenuitemValue(item: MenuitemLike | null): string {
  return item?.value || item?.getAttribute?.("value") || "";
}
