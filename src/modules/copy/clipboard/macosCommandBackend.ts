import type { ClipboardResult } from "../types";
import type { ClipboardBackend } from "./backends";
import type { CommandCall, CommandResult } from "./commandRunner";
import type { ClipboardPayload } from "./types";

export interface MacosCommandBackendDeps {
  probeCommand(name: string): Promise<boolean>;
  runCommand(call: CommandCall): Promise<CommandResult>;
}

const OSASCRIPT_PATH = "/usr/bin/osascript";

export function buildMacClipboardScript(paths: string[]): string {
  const items = paths
    .map((path) => `POSIX file "${escapeAppleScriptString(path)}"`)
    .join(", ");

  return `tell application "Finder" to set the clipboard to {${items}}`;
}

export function createMacosCommandBackend(
  deps: MacosCommandBackendDeps,
): ClipboardBackend {
  return {
    id: "macos-osascript-file-list",
    priority: 95,
    isAvailable: async (payload) => {
      if (!payload.paths.length) {
        return {
          available: false,
          reason: "No files to copy.",
        };
      }

      if (!(await deps.probeCommand("osascript"))) {
        return {
          available: false,
          dependency: "osascript",
          reason: "macOS osascript is required to copy files.",
        };
      }

      return { available: true };
    },
    write: async (payload) => {
      const result = await deps.runCommand({
        command: OSASCRIPT_PATH,
        args: ["-e", buildMacClipboardScript(payload.paths)],
      });

      if (!result.ok) {
        return buildFailureResult(payload);
      }

      return {
        ok: true,
        count: payload.paths.length,
        format: "file-object",
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

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
