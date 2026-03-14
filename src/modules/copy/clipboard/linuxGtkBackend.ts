import type { ClipboardResult } from "../types";
import { buildFailureResult, buildSuccessResult } from "./backends";
import type { ClipboardBackend } from "./backends";
import type {
  CommandCall,
  CommandResult,
  StartCommandOptions,
} from "./commandRunner";
import { buildLinuxClipboardPayloadInput } from "./linuxPayload";
import { BACKEND_IDS, MIME_TYPES, type ClipboardPayload } from "./types";

const GTK_HELPER_COMMAND = "python3";
const GTK_HELPER_DEPENDENCY = "gtk4-helper";
const GTK_HELPER_REASON =
  "Install python3-gi and gir1.2-gtk-4.0 to enable Linux file copy.";
const GTK_HELPER_START_OPTIONS: StartCommandOptions = {
  startupTimeoutMs: 300,
};
const GTK_PROBE_SCRIPT =
  'import gi; gi.require_version("Gtk", "4.0"); gi.require_version("Gdk", "4.0"); from gi.repository import Gtk, Gdk; initialized = Gtk.init_check(); raise SystemExit(0 if initialized and Gdk.Display.get_default() is not None else 1)';
const GTK_HELPER_SCRIPT = String.raw`import json
import signal
import sys

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Gdk", "4.0")

from gi.repository import Gdk, GLib, Gtk


def main() -> int:
    payload = json.load(sys.stdin)
    initialized = Gtk.init_check()
    if not initialized:
        raise RuntimeError("Display unavailable")

    display = Gdk.Display.get_default()
    if display is None:
        raise RuntimeError("Display unavailable")

    clipboard = display.get_clipboard()
    uri_bytes = GLib.Bytes.new(payload["uri_payload"].encode("utf-8"))
    gnome_bytes = GLib.Bytes.new(payload["gnome_payload"].encode("utf-8"))
    provider = Gdk.ContentProvider.new_union(
        [
            Gdk.ContentProvider.new_for_bytes("${MIME_TYPES.URI_LIST}", uri_bytes),
            Gdk.ContentProvider.new_for_bytes(
                "${MIME_TYPES.GNOME_COPIED_FILES}",
                gnome_bytes,
            ),
        ]
    )

    if not clipboard.set_content(provider):
        raise RuntimeError("Failed to claim clipboard ownership")

    loop = GLib.MainLoop()

    def stop_loop(*_args):
        if loop.is_running():
            loop.quit()

    GLib.timeout_add_seconds(20, lambda: (stop_loop(), False)[1])
    signal.signal(signal.SIGINT, stop_loop)
    signal.signal(signal.SIGTERM, stop_loop)
    loop.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`;

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
    args: ["-u", "-c", GTK_HELPER_SCRIPT],
    stdinText: buildLinuxClipboardPayloadInput(payload.fileUris),
  };
}

export function createLinuxGtkBackend(
  deps: LinuxGtkBackendDeps,
): ClipboardBackend {
  return {
    id: BACKEND_IDS.LINUX_GTK4,
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

      return buildSuccessResult(payload, "file-uri-list", "copied-files");
    },
  };
}
