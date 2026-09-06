import { BasicTool, KeyboardManager, unregister } from "zotero-plugin-toolkit";
import { config } from "../../package.json";

export { createZToolkit };

function createZToolkit() {
  const _ztoolkit = new MyToolkit();
  initZToolkit(_ztoolkit);
  return _ztoolkit;
}

function initZToolkit(_ztoolkit: MyToolkit) {
  _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
  _ztoolkit.basicOptions.log.disableConsole = __env__ === "production";
  _ztoolkit.basicOptions.api.pluginID = config.addonID;
}

class MyToolkit extends BasicTool {
  Keyboard: KeyboardManager;

  constructor() {
    super();
    this.Keyboard = new KeyboardManager(this);
  }

  unregisterAll() {
    unregister(this);
  }
}
