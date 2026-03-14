import type { ClipboardResult } from "../types";
import type { ClipboardBackend } from "./backends";
import type {
  CommandCall,
  CommandResult,
  StartCommandOptions,
} from "./commandRunner";
import { buildLinuxClipboardPayloadInput } from "./linuxPayload";
import type { ClipboardPayload } from "./types";

const GTK_HELPER_COMMAND = "python3";
const GTK_HELPER_DEPENDENCY = "gtk4-helper";
const GTK_HELPER_REASON =
  "Install python3-gi and gir1.2-gtk-4.0 to enable Linux file copy.";
const GTK_HELPER_START_OPTIONS: StartCommandOptions = {
  startupTimeoutMs: 300,
};
const GTK_PROBE_SCRIPT =
  'import gi; gi.require_version("Gtk", "4.0"); gi.require_version("Gdk", "4.0"); from gi.repository import Gtk, Gdk; initialized = Gtk.init_check(); raise SystemExit(0 if initialized and Gdk.Display.get_default() is not None else 1)';

export interface LinuxGtkBackendDeps {
  runCommand(call: CommandCall): Promise<CommandResult>;
  startCommand(
    call: CommandCall,
    options?: StartCommandOptions,
  ): Promise<CommandResult>;
}

export function buildLinuxGtkProbeCall(): CommandCall {
  return {
    command: GTK_HELPER_COMMAND,
    args: ["-c", GTK_PROBE_SCRIPT],
  };
}

export function buildLinuxGtkClipboardCommand(
  payload: ClipboardPayload,
): CommandCall {
  return {
    command: GTK_HELPER_COMMAND,
    args: [resolveLinuxGtkHelperPath()],
    stdinText: buildLinuxClipboardPayloadInput(payload.fileUris),
  };
}

export function createLinuxGtkBackend(
  deps: LinuxGtkBackendDeps,
): ClipboardBackend {
  return {
    id: "linux-gtk4-helper",
    priority: 110,
    isAvailable: async (payload) => {
      if (!payload.fileUris.length) {
        return {
          available: false,
          reason: "No file URIs to copy.",
        };
      }

      const probeResult = await deps.runCommand(buildLinuxGtkProbeCall());
      if (!probeResult.ok) {
        return {
          available: false,
          dependency: GTK_HELPER_DEPENDENCY,
          reason: GTK_HELPER_REASON,
        };
      }

      return { available: true };
    },
    write: async (payload) => {
      const result = await deps.startCommand(
        buildLinuxGtkClipboardCommand(payload),
        GTK_HELPER_START_OPTIONS,
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

function resolveLinuxGtkHelperPath(): string {
  if (typeof Services === "undefined" || typeof rootURI !== "string") {
    return "addon/content/helpers/linux_clipboard_helper.py";
  }

  const helperUri = Services.io.newURI(
    `${rootURI}content/helpers/linux_clipboard_helper.py`,
  );
  const fileUri = (helperUri as any).QueryInterface(
    Components.interfaces.nsIFileURL,
  ) as any;

  return fileUri.file.path;
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
