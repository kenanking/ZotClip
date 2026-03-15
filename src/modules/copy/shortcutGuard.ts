import { matchesShortcut, type ParsedShortcut } from "./shortcuts";

export interface ConfiguredShortcutGuardDeps {
  getParsedShortcut(): ParsedShortcut | undefined;
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

  return matchesShortcut(deps.getParsedShortcut(), event);
}
