import {
  ATTACHMENT_TYPE_PRESETS,
  normalizeExtensionList,
} from "./copy/attachmentTypes";
import {
  getClipboardDiagnostics,
  getCustomAttachmentTypes,
  getEnabledAttachmentTypes,
  getLibraryShortcut,
  getMainToolbarButtonEnabled,
  getMultiAttachmentMode,
  getReaderShortcut,
  getReaderToolbarButtonEnabled,
  setPref,
} from "../utils/prefs";
import { renderCopyDiagnosticsLine } from "./copy/copyMessages";
import {
  formatShortcut,
  parseShortcut,
  type ParsedShortcut,
} from "./copy/shortcuts";

interface AttachmentTypeControls {
  panel: HTMLElement;
  presetCheckboxes: HTMLInputElement[];
  customInput: HTMLInputElement;
  validationMessage: HTMLElement;
}

interface ShortcutControls {
  libraryInput: HTMLInputElement;
  readerInput: HTMLInputElement;
  validationMessage: HTMLElement;
  conflictMessage: HTMLElement;
  diagnosticsValue: HTMLElement | null;
}

export interface ToolbarButtonControls {
  mainToolbarCheckbox: HTMLInputElement;
  readerToolbarCheckbox: HTMLInputElement;
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

export function normalizeShortcutInput(value: string): string {
  return formatShortcut(parseShortcut(value));
}

export function validateShortcutInput(value: string): boolean {
  return value.trim().length === 0 || !!parseShortcut(value);
}

export function areShortcutInputsConflicting(
  libraryShortcut: string,
  readerShortcut: string,
): boolean {
  const normalizedLibraryShortcut = normalizeShortcutInput(libraryShortcut);
  const normalizedReaderShortcut = normalizeShortcutInput(readerShortcut);

  return (
    !!normalizedLibraryShortcut &&
    normalizedLibraryShortcut === normalizedReaderShortcut
  );
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

export function readToolbarButtonVisibility(controls: ToolbarButtonControls): {
  showMainToolbarButton: boolean;
  showReaderToolbarButton: boolean;
} {
  return {
    showMainToolbarButton: controls.mainToolbarCheckbox.checked,
    showReaderToolbarButton: controls.readerToolbarCheckbox.checked,
  };
}

export function persistToolbarButtonPrefs(
  controls: ToolbarButtonControls,
  setPreference: (
    key: "showMainToolbarButton" | "showReaderToolbarButton",
    value: boolean,
  ) => unknown = setPref,
): void {
  const visibility = readToolbarButtonVisibility(controls);
  setPreference("showMainToolbarButton", visibility.showMainToolbarButton);
  setPreference("showReaderToolbarButton", visibility.showReaderToolbarButton);
}

export async function registerPrefsScripts(window: Window) {
  addon.data.prefs = {
    window,
  };

  syncPreferenceMenulists(window.document);

  const attachmentTypeControls = getAttachmentTypeControls(window.document);
  const shortcutControls = getShortcutControls(window.document);
  const toolbarButtonControls = getToolbarButtonControls(window.document);

  if (attachmentTypeControls) {
    syncAttachmentTypeControls(attachmentTypeControls);
    registerAttachmentTypeEvents(attachmentTypeControls);
  }

  if (toolbarButtonControls) {
    syncToolbarButtonControls(toolbarButtonControls);
    registerToolbarButtonEvents(toolbarButtonControls);
  }

  if (shortcutControls) {
    syncShortcutControls(shortcutControls);
    registerShortcutEvents(shortcutControls);
    await renderDiagnostics(shortcutControls);
  }
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

function getShortcutControls(doc: Document): ShortcutControls | undefined {
  const libraryInput = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-library-shortcut]",
  );
  const readerInput = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-reader-shortcut]",
  );
  const validationMessage = doc.querySelector<HTMLElement>(
    "[data-zotclip-shortcut-validation]",
  );
  const conflictMessage = doc.querySelector<HTMLElement>(
    "[data-zotclip-shortcut-conflict]",
  );
  const diagnosticsValue = doc.querySelector<HTMLElement>(
    "[data-zotclip-diagnostics-value]",
  );

  if (!libraryInput || !readerInput || !validationMessage || !conflictMessage) {
    return undefined;
  }

  return {
    libraryInput,
    readerInput,
    validationMessage,
    conflictMessage,
    diagnosticsValue,
  };
}

function getToolbarButtonControls(
  doc: Document,
): ToolbarButtonControls | undefined {
  const mainToolbarCheckbox = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-main-toolbar-button]",
  );
  const readerToolbarCheckbox = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-reader-toolbar-button]",
  );

  if (!mainToolbarCheckbox || !readerToolbarCheckbox) {
    return undefined;
  }

  return {
    mainToolbarCheckbox,
    readerToolbarCheckbox,
  };
}

function syncAttachmentTypeControls(controls: AttachmentTypeControls): void {
  const enabledTypes = getEnabledAttachmentTypes().filter((type) =>
    PRESET_TYPE_SET.has(type),
  );
  const enabledTypeSet = new Set(enabledTypes);

  for (const checkbox of controls.presetCheckboxes) {
    checkbox.checked = enabledTypeSet.has(getCheckboxType(checkbox));
  }

  controls.customInput.value = getCustomAttachmentTypes().join(", ");
  syncAttachmentTypeValidation(controls);
}

function syncToolbarButtonControls(controls: ToolbarButtonControls): void {
  controls.mainToolbarCheckbox.checked = getMainToolbarButtonEnabled();
  controls.readerToolbarCheckbox.checked = getReaderToolbarButtonEnabled();
}

function registerAttachmentTypeEvents(controls: AttachmentTypeControls): void {
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

function registerToolbarButtonEvents(controls: ToolbarButtonControls): void {
  const persist = () => persistToolbarButtonPrefs(controls);
  controls.mainToolbarCheckbox.addEventListener("change", persist);
  controls.readerToolbarCheckbox.addEventListener("change", persist);
}

function syncShortcutControls(controls: ShortcutControls): void {
  controls.libraryInput.value = getLibraryShortcut();
  controls.readerInput.value = getReaderShortcut();
  syncShortcutValidation(controls);
}

function registerShortcutEvents(controls: ShortcutControls): void {
  const persist = () => persistShortcutPrefs(controls);

  for (const input of [controls.libraryInput, controls.readerInput]) {
    input.addEventListener("keydown", (event: KeyboardEvent) => {
      const shortcut = buildShortcutFromEvent(event);
      if (shortcut === undefined) {
        return;
      }

      event.preventDefault();
      input.value = shortcut;
      syncShortcutValidation(controls);
    });

    input.addEventListener("input", () => {
      syncShortcutValidation(controls);
    });
    input.addEventListener("change", persist);
    input.addEventListener("blur", persist);
  }
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

function persistShortcutPrefs(controls: ShortcutControls): void {
  controls.libraryInput.value = normalizeShortcutInput(
    controls.libraryInput.value,
  );
  controls.readerInput.value = normalizeShortcutInput(
    controls.readerInput.value,
  );

  const validation = getShortcutValidationState(controls);
  applyShortcutValidationState(controls, validation);
  if (!validation.isValid) {
    return;
  }

  setPref("libraryShortcut", controls.libraryInput.value);
  setPref("readerShortcut", controls.readerInput.value);
}

function syncShortcutValidation(controls: ShortcutControls): void {
  applyShortcutValidationState(controls, getShortcutValidationState(controls));
}

function getShortcutValidationState(controls: ShortcutControls): {
  isValid: boolean;
  hasConflict: boolean;
} {
  const libraryValid = validateShortcutInput(controls.libraryInput.value);
  const readerValid = validateShortcutInput(controls.readerInput.value);
  const hasConflict = areShortcutInputsConflicting(
    controls.libraryInput.value,
    controls.readerInput.value,
  );

  return {
    isValid: libraryValid && readerValid && !hasConflict,
    hasConflict,
  };
}

function applyShortcutValidationState(
  controls: ShortcutControls,
  validation: { isValid: boolean; hasConflict: boolean },
): void {
  const libraryValid = validateShortcutInput(controls.libraryInput.value);
  const readerValid = validateShortcutInput(controls.readerInput.value);

  controls.libraryInput.dataset.invalid = libraryValid ? "false" : "true";
  controls.readerInput.dataset.invalid = readerValid ? "false" : "true";
  controls.validationMessage.hidden = libraryValid && readerValid;
  controls.conflictMessage.hidden = !validation.hasConflict;
}

async function renderDiagnostics(controls: ShortcutControls): Promise<void> {
  if (!controls.diagnosticsValue) {
    return;
  }

  try {
    const diagnostics = await getClipboardDiagnostics();
    controls.diagnosticsValue.textContent = diagnostics.lines
      .map((line) => renderCopyDiagnosticsLine(line))
      .join("\n");
  } catch (error) {
    controls.diagnosticsValue.textContent = `Diagnostics unavailable: ${getErrorMessage(error)}`;
  }
}

function buildShortcutFromEvent(event: KeyboardEvent): string | undefined {
  if (event.key === "Tab") {
    return undefined;
  }

  if (event.key === "Backspace" || event.key === "Delete") {
    return "";
  }

  const parsedShortcut = buildParsedShortcutFromEvent(event);
  return formatShortcut(parsedShortcut);
}

function buildParsedShortcutFromEvent(
  event: KeyboardEvent,
): ParsedShortcut | undefined {
  const key = event.key.toLowerCase();
  if (isModifierKey(key)) {
    return undefined;
  }

  return {
    ctrlOrMeta: event.ctrlKey || event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey,
    key,
  };
}

function isModifierKey(key: string): boolean {
  return (
    key === "control" || key === "shift" || key === "alt" || key === "meta"
  );
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
