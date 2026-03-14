import { matchesShortcut, parseShortcut } from "./shortcuts";

export interface ConfiguredShortcutGuardDeps {
  getShortcut(): string;
  matchesContext(event: KeyboardEvent): boolean;
}

export function shouldHandleConfiguredShortcut(
  event: KeyboardEvent,
  deps: ConfiguredShortcutGuardDeps,
): boolean {
  if (event.defaultPrevented) {
    return false;
  }

  if (!deps.matchesContext(event)) {
    return false;
  }

  return matchesShortcut(parseShortcut(deps.getShortcut()), event);
}
