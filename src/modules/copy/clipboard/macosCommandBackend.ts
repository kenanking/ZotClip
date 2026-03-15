import type { ClipboardResult } from "../types";
import { buildFailureResult, buildSuccessResult } from "./backends";
import type { ClipboardBackend } from "./backends";
import type { CommandCall, CommandResult } from "./commandRunner";
import { BACKEND_IDS, type ClipboardPayload } from "./types";

export interface MacosCommandBackendDeps {
  probeCommand(name: string): Promise<boolean>;
  runCommand(call: CommandCall): Promise<CommandResult>;
}

const OSASCRIPT_PATH = "/usr/bin/osascript";

export function buildMacClipboardScript(paths: string[]): string {
  const addUrlLines = paths.map(
    (path) =>
      `(fileURLs's addObject:(current application's NSURL's fileURLWithPath:"${escapeAppleScriptString(path)}"))`,
  );

  return [
    'use framework "AppKit"',
    'use framework "Foundation"',
    "",
    "set pasteboard to current application's NSPasteboard's generalPasteboard()",
    "pasteboard's clearContents()",
    "set fileURLs to current application's NSMutableArray's array()",
    ...addUrlLines,
    "set didWrite to (pasteboard's writeObjects:fileURLs) as boolean",
    'if not didWrite then error "Failed to write file URLs to NSPasteboard"',
  ].join("\n");
}

export function createMacosCommandBackend(
  deps: MacosCommandBackendDeps,
): ClipboardBackend {
  return {
    id: BACKEND_IDS.MACOS_OSASCRIPT,
    priority: 95,
    isAvailable: async (payload) => {
      if (!payload.paths.length) {
        return {
          available: false,
          reasonKey: "copy-no-files",
        };
      }

      if (!(await deps.probeCommand("osascript"))) {
        return {
          available: false,
          dependency: "osascript",
          reasonKey: "copy-macos-osascript-missing",
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

      return buildSuccessResult(payload, "file-object", "copied-files");
    },
  };
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
