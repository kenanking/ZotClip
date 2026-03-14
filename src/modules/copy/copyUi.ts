import { config } from "../../../package.json";

export const TOOLBAR_ICON_URL = `chrome://${config.addonRef}/content/icons/toolbar-icon.svg`;

export function getToolbarTooltipText(
  label: string,
  availability: {
    canCopy: boolean;
    unavailableMessage?: string;
  },
): string {
  return availability.canCopy ? label : availability.unavailableMessage || label;
}
