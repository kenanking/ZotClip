import { config } from "../../../package.json";

export const TOOLBAR_ICON_URL = `chrome://${config.addonRef}/content/icons/toolbar-icon.svg`;
let toolbarIconDataURL = "";

export async function initToolbarIcon(options?: {
  readIcon?: () => Promise<string>;
}): Promise<void> {
  const readIcon =
    options?.readIcon ||
    (() => Zotero.File.getContentsFromURLAsync(TOOLBAR_ICON_URL));
  const iconSvg = await readIcon();
  toolbarIconDataURL = `data:image/svg+xml;utf8,${encodeURIComponent(iconSvg)}`;
}

export function getToolbarIconDataURL(): string {
  return toolbarIconDataURL;
}
