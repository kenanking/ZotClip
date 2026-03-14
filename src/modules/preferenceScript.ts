import {
  registerPrefsUI,
  type PrefsUIHandle,
} from "./copy/preferences/registerPrefsUI";

export interface PreferenceScriptDeps {
  registerPrefsUI?: (window: Window) => Promise<PrefsUIHandle>;
}

export async function registerPrefsScripts(
  window: Window,
  deps: PreferenceScriptDeps = {},
): Promise<PrefsUIHandle> {
  return (deps.registerPrefsUI || registerPrefsUI)(window);
}
