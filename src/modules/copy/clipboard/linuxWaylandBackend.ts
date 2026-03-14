import type { ClipboardResult } from "../types";
import type { ClipboardBackend } from "./backends";
import type { CommandCall, CommandResult } from "./commandRunner";
import { buildLinuxClipboardPayload } from "./linuxPayload";
import type { ClipboardPayload } from "./types";

const WL_COPY_COMMAND = "wl-copy";
const URI_LIST_MIME = "text/uri-list";

export interface LinuxWaylandBackendDeps {
  probeCommand(name: string): Promise<boolean>;
  runCommand(call: CommandCall): Promise<CommandResult>;
}

export function buildLinuxWaylandClipboardCall(
  payload: ClipboardPayload,
): CommandCall {
  return {
    command: WL_COPY_COMMAND,
    args: ["--type", URI_LIST_MIME],
    stdinText: buildLinuxClipboardPayload(payload.fileUris).uriListText,
  };
}

export function createLinuxWaylandBackend(
  deps: LinuxWaylandBackendDeps,
): ClipboardBackend {
  return {
    id: "linux-wayland-wl-copy-uri-list",
    priority: 110,
    isAvailable: async (payload) => {
      if (!payload.fileUris.length) {
        return {
          available: false,
          reason: "No file URIs to copy.",
        };
      }

      if (!(await deps.probeCommand(WL_COPY_COMMAND))) {
        return {
          available: false,
          dependency: "wl-clipboard",
          reason: "Install wl-clipboard to enable file copy on Wayland.",
        };
      }

      return { available: true };
    },
    write: async (payload) => {
      const result = await deps.runCommand(
        buildLinuxWaylandClipboardCall(payload),
      );

      if (!result.ok) {
        return buildFailureResult(payload);
      }

      return {
        ok: true,
        count: payload.paths.length,
        format: "file-uri-list",
        outcome: "copied-files",
      };
    },
  };
}

function buildFailureResult(payload: ClipboardPayload): ClipboardResult {
  return {
    ok: false,
    count: payload.paths.length,
    format: "none",
    outcome: "copy-failed",
    message: "Clipboard write failed.",
  };
}
