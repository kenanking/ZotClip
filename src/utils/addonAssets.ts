import { config } from "../../package.json";

export function getAddonFaviconUri(): string {
  return `chrome://${config.addonRef}/content/icons/favicon.svg`;
}
