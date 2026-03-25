import {
  BasicTool,
  KeyboardManager,
  makeHelperTool,
  ProgressWindowHelper,
  unregister,
} from "zotero-plugin-toolkit";
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
  _ztoolkit.ProgressWindow.setIconURI(
    "default",
    `chrome://${config.addonRef}/content/icons/favicon.svg`,
  );
}

class MyToolkit extends BasicTool {
  Keyboard: KeyboardManager;
  ProgressWindow: typeof ProgressWindowHelper;

  constructor() {
    super();
    this.Keyboard = new KeyboardManager(this);
    this.ProgressWindow = makeHelperTool(ProgressWindowHelper, this);
  }

  unregisterAll() {
    unregister(this);
  }
}
