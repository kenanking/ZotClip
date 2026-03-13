import type { ClipboardResult } from "../types";
import type { ClipboardBackend } from "./backends";
import type { CommandCall, CommandResult } from "./commandRunner";
import type { ClipboardPayload } from "./types";

export interface LinuxCommandBackendDeps {
  probeCommand(name: string): Promise<boolean>;
  runCommand(call: CommandCall): Promise<CommandResult>;
}

interface LinuxBackendConfig {
  args: string[];
  command: string;
  dependency: string;
  id: string;
  priority: number;
  reason: string;
}

const URI_LIST_FLAVOR = "text/uri-list";

export function createLinuxX11Backend(
  deps: LinuxCommandBackendDeps,
): ClipboardBackend {
  return createLinuxUriListBackend(
    {
      id: "linux-x11-xclip-uri-list",
      priority: 90,
      command: "xclip",
      args: ["-selection", "clipboard", "-t", URI_LIST_FLAVOR, "-silent", "-i"],
      dependency: "xclip",
      reason: "Install xclip to enable file copy on X11.",
    },
    deps,
  );
}

export function createLinuxWaylandBackend(
  deps: LinuxCommandBackendDeps,
): ClipboardBackend {
  return createLinuxUriListBackend(
    {
      id: "linux-wayland-wl-copy-uri-list",
      priority: 95,
      command: "wl-copy",
      args: ["--type", URI_LIST_FLAVOR],
      dependency: "wl-clipboard",
      reason: "Install wl-clipboard to enable file copy on Wayland.",
    },
    deps,
  );
}

function createLinuxUriListBackend(
  config: LinuxBackendConfig,
  deps: LinuxCommandBackendDeps,
): ClipboardBackend {
  return {
    id: config.id,
    priority: config.priority,
    isAvailable: async (payload) => {
      if (!payload.fileUris.length) {
        return {
          available: false,
          reason: "No file URIs to copy.",
        };
      }

      if (!(await deps.probeCommand(config.command))) {
        return {
          available: false,
          dependency: config.dependency,
          reason: config.reason,
        };
      }

      return { available: true };
    },
    write: async (payload) => {
      const result = await deps.runCommand({
        command: config.command,
        args: config.args,
        stdinText: buildUriListClipboardInput(payload),
      });

      if (!result.ok) {
        return buildFailureResult(payload);
      }

      return {
        ok: true,
        count: payload.paths.length,
        format: "file-uri-list",
        outcome: "copied-file-uris",
      };
    },
  };
}

function buildUriListClipboardInput(payload: ClipboardPayload): string {
  return `${payload.fileUris.join("\r\n")}\r\n`;
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
