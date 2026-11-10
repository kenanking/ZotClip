import {
  renderCopyMessage,
  type CopyMessageRenderDeps,
} from "../../copyMessages";
import type { CopyActionState } from "../actions/copyActionTypes";

export function buildActionTooltip(
  defaultLabel: string,
  state: Pick<CopyActionState, "primary">,
  deps: CopyMessageRenderDeps = {},
): string {
  if (state.primary.canExecute) {
    return defaultLabel;
  }

  return renderCopyMessage(
    state.primary.reasonKey || "copy-no-files",
    undefined,
    deps,
  );
}
