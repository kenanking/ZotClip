import type { ClipboardResult } from "../types";
import { buildFailureResult, buildSuccessResult } from "./backends";
import type { ClipboardBackend } from "./backends";
import type { CommandCall, CommandResult } from "./commandRunner";
import { buildLinuxClipboardPayload } from "./linuxPayload";
import { BACKEND_IDS, MIME_TYPES, type ClipboardPayload } from "./types";

const WL_COPY_COMMAND = "wl-copy";

export interface LinuxWaylandBackendDeps {
  probeCommand(name: string): Promise<boolean>;
  runCommand(call: CommandCall): Promise<CommandResult>;
}

export function buildLinuxWaylandClipboardCall(
  payload: ClipboardPayload,
): CommandCall {
  return {
    command: WL_COPY_COMMAND,
    args: ["--type", MIME_TYPES.URI_LIST],
    stdinText: buildLinuxClipboardPayload(payload.fileUris).uriListText,
  };
}

export function createLinuxWaylandBackend(
  deps: LinuxWaylandBackendDeps,
): ClipboardBackend {
  return {
    id: BACKEND_IDS.LINUX_WAYLAND,
    priority: 110,
    isAvailable: async (payload) => {
      if (!payload.fileUris.length) {
        return {
          available: false,
          reasonKey: "copy-no-file-uris",
        };
      }

      if (!(await deps.probeCommand(WL_COPY_COMMAND))) {
        return {
          available: false,
          dependency: "wl-clipboard",
          reasonKey: "copy-linux-wl-copy-missing",
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

      return buildSuccessResult(payload, "file-uri-list", "copied-files");
    },
  };
}
