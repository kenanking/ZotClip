import {
  formatCopyResultMessage,
  renderCopyMessage,
  type CopyMessageRenderDeps,
} from "../../copyMessages";
import type { ClipboardResult } from "../../types";
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

export function formatActionExecutionMessage(
  result: ClipboardResult,
  deps: CopyMessageRenderDeps = {},
): string {
  if (result.outcome === "copied-path-text-explicit") {
    return renderCopyMessage(
      result.messageKey || "copy-path-text-explicit",
      {
        count: result.count,
        ...(result.messageArgs || {}),
      },
      deps,
    );
  }

  return formatCopyResultMessage(result, deps);
}
