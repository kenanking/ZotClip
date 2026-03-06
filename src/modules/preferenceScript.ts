import {
  ATTACHMENT_TYPE_PRESETS,
  normalizeExtensionList,
} from "./copy/attachmentTypes";
import {
  getCustomAttachmentTypes,
  getEnabledAttachmentTypes,
  getMultiAttachmentMode,
  getReaderCtrlCMode,
  setPref,
} from "../utils/prefs";

interface AttachmentTypeControls {
  panel: HTMLElement;
  presetCheckboxes: HTMLInputElement[];
  customInput: HTMLInputElement;
  validationMessage: HTMLElement;
}

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

const PRESET_TYPE_SET = new Set<string>(ATTACHMENT_TYPE_PRESETS);

export function buildEffectiveAttachmentTypes(
  enabledTypes: string[],
  customInput: string,
): string[] {
  return normalizeExtensionList([
    ...enabledTypes,
    ...normalizeExtensionList(customInput),
  ]);
}

export function validateAttachmentTypeSelection(
  enabledTypes: string[],
  customInput: string,
): boolean {
  return buildEffectiveAttachmentTypes(enabledTypes, customInput).length > 0;
}

export function syncMenulistValue(
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

export async function registerPrefsScripts(window: Window) {
  addon.data.prefs = {
    window,
  };

  syncPreferenceMenulists(window.document);

  const controls = getAttachmentTypeControls(window.document);
  if (!controls) {
    return;
  }

  const enabledTypes = getEnabledAttachmentTypes().filter((type) =>
    PRESET_TYPE_SET.has(type),
  );
  const enabledTypeSet = new Set(enabledTypes);

  for (const checkbox of controls.presetCheckboxes) {
    checkbox.checked = enabledTypeSet.has(getCheckboxType(checkbox));
  }

  controls.customInput.value = getCustomAttachmentTypes().join(", ");
  syncAttachmentTypeValidation(controls);

  for (const checkbox of controls.presetCheckboxes) {
    checkbox.addEventListener("change", () => {
      persistAttachmentTypePrefs(controls);
    });
  }

  controls.customInput.addEventListener("input", () => {
    syncAttachmentTypeValidation(controls);
  });
  controls.customInput.addEventListener("change", () => {
    persistAttachmentTypePrefs(controls);
  });
  controls.customInput.addEventListener("blur", () => {
    persistAttachmentTypePrefs(controls);
  });
}

function syncPreferenceMenulists(doc: Document): void {
  registerMenulistSync(
    doc.getElementById(
      "zotero-prefpane-__addonRef__-multi-attachment-mode",
    ) as MenulistLike | null,
    getMultiAttachmentMode(),
  );
  registerMenulistSync(
    doc.getElementById(
      "zotero-prefpane-__addonRef__-reader-ctrl-c-mode",
    ) as MenulistLike | null,
    getReaderCtrlCMode(),
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

function getAttachmentTypeControls(
  doc: Document,
): AttachmentTypeControls | undefined {
  const panel = doc.querySelector<HTMLElement>("[data-zotclip-types-panel]");
  const customInput = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-custom-types]",
  );
  const validationMessage = doc.querySelector<HTMLElement>(
    "[data-zotclip-type-validation]",
  );
  const presetCheckboxes = Array.from(
    doc.querySelectorAll("[data-zotclip-attachment-type]"),
  ) as HTMLInputElement[];

  if (
    !panel ||
    !customInput ||
    !validationMessage ||
    !presetCheckboxes.length
  ) {
    return undefined;
  }

  return {
    panel,
    presetCheckboxes,
    customInput,
    validationMessage,
  };
}

function persistAttachmentTypePrefs(controls: AttachmentTypeControls): void {
  const selectedPresetTypes = getSelectedPresetTypes(controls.presetCheckboxes);
  const normalizedCustomTypes = normalizeExtensionList(
    controls.customInput.value,
  );
  controls.customInput.value = normalizedCustomTypes.join(", ");

  const isValid = validateAttachmentTypeSelection(
    selectedPresetTypes,
    controls.customInput.value,
  );
  setAttachmentTypeValidationState(controls, !isValid);
  if (!isValid) {
    return;
  }

  setPref("enabledAttachmentTypes", selectedPresetTypes.join(","));
  setPref("customAttachmentTypes", normalizedCustomTypes.join(","));
}

function syncAttachmentTypeValidation(controls: AttachmentTypeControls): void {
  setAttachmentTypeValidationState(
    controls,
    !validateAttachmentTypeSelection(
      getSelectedPresetTypes(controls.presetCheckboxes),
      controls.customInput.value,
    ),
  );
}

function setAttachmentTypeValidationState(
  controls: AttachmentTypeControls,
  isInvalid: boolean,
): void {
  controls.panel.dataset.invalid = isInvalid ? "true" : "false";
  controls.customInput.dataset.invalid = isInvalid ? "true" : "false";
  controls.validationMessage.hidden = !isInvalid;
}

function getSelectedPresetTypes(checkboxes: HTMLInputElement[]): string[] {
  return checkboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => getCheckboxType(checkbox));
}

function getCheckboxType(checkbox: HTMLInputElement): string {
  return checkbox.dataset.zotclipAttachmentType || "";
}

function getMenulistCurrentValue(menulist: MenulistLike): string {
  return menulist.value || getMenuitemValue(menulist.selectedItem || null);
}

function getMenuitemValue(item: MenuitemLike | null): string {
  return item?.value || item?.getAttribute?.("value") || "";
}
