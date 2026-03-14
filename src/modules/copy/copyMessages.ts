import { getString } from "../../utils/locale";
import type { FluentMessageId } from "../../../typings/i10n";
import type { CopyMessageArgs, CopyMessageKey, ClipboardResult } from "./types";
import type { ClipboardDiagnosticsLine } from "./clipboard/diagnostics";

type CopyLocaleMessageKey =
  | CopyMessageKey
  | "copy-diagnostics-active-backend"
  | "copy-diagnostics-command-available"
  | "copy-diagnostics-command-missing"
  | "copy-diagnostics-install-command"
  | "copy-diagnostics-note"
  | "copy-diagnostics-platform"
  | "copy-diagnostics-platform-linux"
  | "copy-diagnostics-troubleshoot"
  | "copy-notify-files"
  | "copy-notify-files-file-object"
  | "copy-notify-files-with-format"
  | "copy-notify-generic-failure";

export interface CopyMessageRenderDeps {
  renderMessage?(
    key: CopyLocaleMessageKey,
    args?: Record<string, unknown>,
  ): string;
}

export function formatCopyResultMessage(
  result: ClipboardResult,
  deps: CopyMessageRenderDeps = {},
): string {
  if (
    (result.outcome === "backend-unavailable" ||
      result.outcome === "dependency-missing") &&
    result.messageKey
  ) {
    return renderCopyMessage(result.messageKey, result.messageArgs, deps);
  }

  if (result.outcome === "copied-files") {
    return renderCopyMessage(
      result.format === "file-object"
        ? "copy-notify-files-file-object"
        : "copy-notify-files",
      {
        count: result.count,
      },
      deps,
    );
  }

  if (result.outcome === "copied-path-text-fallback") {
    return renderCopyMessage(
      result.messageKey || "copy-path-text-fallback",
      buildMessageArgs(result, {
        count: result.count,
      }),
      deps,
    );
  }

  if (result.messageKey && !result.ok) {
    return renderCopyMessage(result.messageKey, result.messageArgs, deps);
  }

  if (!result.ok) {
    return renderCopyMessage("copy-notify-generic-failure", undefined, deps);
  }

  if (result.format === "path-text") {
    return renderCopyMessage(
      "copy-path-text-fallback",
      buildMessageArgs(result, {
        count: result.count,
      }),
      deps,
    );
  }

  return renderCopyMessage(
    "copy-notify-files-with-format",
    {
      count: result.count,
      format: result.format,
    },
    deps,
  );
}

export function renderCopyMessage(
  key: CopyLocaleMessageKey,
  args?: CopyMessageArgs,
  deps: CopyMessageRenderDeps = {},
): string {
  if (deps.renderMessage) {
    return deps.renderMessage(key, args);
  }

  return args
    ? getString(key as FluentMessageId, { args })
    : getString(key as FluentMessageId);
}

export function renderCopyDiagnosticsLine(
  line: ClipboardDiagnosticsLine,
  deps: CopyMessageRenderDeps = {},
): string {
  if (line.messageKey) {
    return renderCopyMessage(
      line.key,
      {
        ...(line.args || {}),
        message: renderCopyMessage(line.messageKey, line.messageArgs, deps),
      },
      deps,
    );
  }

  return renderCopyMessage(line.key, line.args, deps);
}

function buildMessageArgs(
  result: ClipboardResult,
  defaults: CopyMessageArgs,
): CopyMessageArgs {
  return {
    ...defaults,
    ...(result.messageArgs || {}),
  };
}
