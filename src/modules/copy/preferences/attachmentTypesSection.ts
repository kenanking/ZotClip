import {
  ATTACHMENT_TYPE_PRESETS,
  normalizeExtensionList,
} from "../attachmentTypes";
import {
  getCustomAttachmentTypes,
  getEnabledAttachmentTypes,
  setPref,
} from "../../../utils/prefs";

interface AttachmentTypeControls {
  panel: HTMLElement;
  presetCheckboxes: HTMLInputElement[];
  customInput: HTMLInputElement;
  validationMessage: HTMLElement;
}

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

const PRESET_TYPE_SET = new Set<string>(ATTACHMENT_TYPE_PRESETS);

export async function registerAttachmentTypesSection(doc: Document): Promise<{
  dispose(): void;
}> {
  const controls = getAttachmentTypeControls(doc);
  if (!controls) {
    return createNoopHandle();
  }

  syncAttachmentTypeControls(controls);
  const disposers = [
    ...controls.presetCheckboxes.map((checkbox) =>
      addEventListener(checkbox, "change", () => {
        persistAttachmentTypePrefs(controls);
      }),
    ),
    addEventListener(controls.customInput, "input", () => {
      syncAttachmentTypeValidation(controls);
    }),
    addEventListener(controls.customInput, "change", () => {
      persistAttachmentTypePrefs(controls);
    }),
    addEventListener(controls.customInput, "blur", () => {
      persistAttachmentTypePrefs(controls);
    }),
  ];

  return {
    dispose(): void {
      for (const dispose of disposers) {
        dispose();
      }
    },
  };
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

function createNoopHandle(): { dispose(): void } {
  return {
    dispose(): void {},
  };
}

function addEventListener<T extends EventTarget>(
  target: T,
  type: string,
  listener: EventListener,
): () => void {
  target.addEventListener(type, listener);
  return () => {
    target.removeEventListener(type, listener);
  };
}
