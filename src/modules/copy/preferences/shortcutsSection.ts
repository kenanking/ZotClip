import { getLibraryShortcut, getReaderShortcut, setPref } from "../../../utils/prefs";
import {
  formatShortcut,
  parseShortcut,
  type ParsedShortcut,
} from "../shortcuts";

interface ShortcutControls {
  libraryInput: HTMLInputElement;
  readerInput: HTMLInputElement;
  validationMessage: HTMLElement;
  conflictMessage: HTMLElement;
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

export async function registerShortcutsSection(doc: Document): Promise<{
  dispose(): void;
}> {
  const controls = getShortcutControls(doc);
  if (!controls) {
    return createNoopHandle();
  }

  syncShortcutControls(controls);
  const persist = () => persistShortcutPrefs(controls);
  const disposers = [controls.libraryInput, controls.readerInput].flatMap(
    (input) => [
      addEventListener(input, "keydown", (event: Event) => {
        const shortcut = buildShortcutFromEvent(event as KeyboardEvent);
        if (shortcut === undefined) {
          return;
        }

        (event as KeyboardEvent).preventDefault();
        input.value = shortcut;
        syncShortcutValidation(controls);
      }),
      addEventListener(input, "input", () => {
        syncShortcutValidation(controls);
      }),
      addEventListener(input, "change", persist),
      addEventListener(input, "blur", persist),
    ],
  );

  return {
    dispose(): void {
      for (const dispose of disposers) {
        dispose();
      }
    },
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

  if (!libraryInput || !readerInput || !validationMessage || !conflictMessage) {
    return undefined;
  }

  return {
    libraryInput,
    readerInput,
    validationMessage,
    conflictMessage,
  };
}

function syncShortcutControls(controls: ShortcutControls): void {
  controls.libraryInput.value = getLibraryShortcut();
  controls.readerInput.value = getReaderShortcut();
  syncShortcutValidation(controls);
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
