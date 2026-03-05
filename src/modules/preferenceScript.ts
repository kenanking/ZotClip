export async function registerPrefsScripts(_window: Window) {
  addon.data.prefs = {
    window: _window,
  };
}
