import type { ClipboardResult } from "../types";
import type { ClipboardBackend } from "./backends";
import type {
  CommandCall,
  CommandResult,
  StartCommandOptions,
} from "./commandRunner";
import type { ClipboardPayload } from "./types";

const GTK_HELPER_COMMAND = "python3";
const X11_CLIPBOARD_ATOM = "CLIPBOARD";
const URI_LIST_TARGET = "text/uri-list";
const GNOME_COPIED_FILES_TARGET = "x-special/gnome-copied-files";
const GTK_HELPER_DEPENDENCY = "python3-gi";
const GTK_HELPER_REASON = "Install python3-gi to enable file copy on X11.";
const GTK_HELPER_START_OPTIONS: StartCommandOptions = {
  startupTimeoutMs: 150,
};
const GTK_PROBE_SCRIPT =
  'import gi; gi.require_version("Gtk", "3.0"); from gi.repository import Gtk, Gdk; raise SystemExit(0 if Gdk.Display.get_default() is not None else 1)';
const GTK_CLIPBOARD_OWNER_SCRIPT = String.raw`import ctypes
import ctypes.util
import json
import signal
import sys

import gi

gi.require_version("Gtk", "3.0")

from gi.repository import Gtk

payload = json.load(sys.stdin)
uri_payload = payload["uri_payload"].encode("utf-8")
gnome_payload = payload["gnome_payload"].encode("utf-8")
gtk = ctypes.CDLL(ctypes.util.find_library("gtk-3") or "libgtk-3.so.0")
gdk = ctypes.CDLL(ctypes.util.find_library("gdk-3") or "libgdk-3.so.0")

class GtkTargetEntry(ctypes.Structure):
    _fields_ = [
        ("target", ctypes.c_char_p),
        ("flags", ctypes.c_uint),
        ("info", ctypes.c_uint),
    ]

GtkClipboardGetFunc = ctypes.CFUNCTYPE(
    None,
    ctypes.c_void_p,
    ctypes.c_void_p,
    ctypes.c_uint,
    ctypes.c_void_p,
)
GtkClipboardClearFunc = ctypes.CFUNCTYPE(None, ctypes.c_void_p, ctypes.c_void_p)

gdk.gdk_atom_intern_static_string.argtypes = [ctypes.c_char_p]
gdk.gdk_atom_intern_static_string.restype = ctypes.c_void_p
gtk.gtk_clipboard_get.argtypes = [ctypes.c_void_p]
gtk.gtk_clipboard_get.restype = ctypes.c_void_p
gtk.gtk_clipboard_set_with_data.argtypes = [
    ctypes.c_void_p,
    ctypes.POINTER(GtkTargetEntry),
    ctypes.c_uint,
    GtkClipboardGetFunc,
    GtkClipboardClearFunc,
    ctypes.c_void_p,
]
gtk.gtk_clipboard_set_with_data.restype = ctypes.c_int
gtk.gtk_clipboard_set_can_store.argtypes = [
    ctypes.c_void_p,
    ctypes.POINTER(GtkTargetEntry),
    ctypes.c_int,
]
gtk.gtk_clipboard_store.argtypes = [ctypes.c_void_p]
gtk.gtk_selection_data_set.argtypes = [
    ctypes.c_void_p,
    ctypes.c_void_p,
    ctypes.c_int,
    ctypes.POINTER(ctypes.c_ubyte),
    ctypes.c_int,
]
gtk.gtk_selection_data_set.restype = ctypes.c_int
gtk.gtk_main.argtypes = []
gtk.gtk_main.restype = None
gtk.gtk_main_quit.argtypes = []
gtk.gtk_main_quit.restype = None

initialized, _argv = Gtk.init_check()
if not initialized:
    raise RuntimeError("X11 display unavailable")

targets = (GtkTargetEntry * 2)(
    GtkTargetEntry(b"${URI_LIST_TARGET}", 0, 0),
    GtkTargetEntry(b"${GNOME_COPIED_FILES_TARGET}", 0, 1),
)
target_atoms = {
    0: gdk.gdk_atom_intern_static_string(b"${URI_LIST_TARGET}"),
    1: gdk.gdk_atom_intern_static_string(b"${GNOME_COPIED_FILES_TARGET}"),
}
buffers = {
    0: ctypes.create_string_buffer(uri_payload),
    1: ctypes.create_string_buffer(gnome_payload),
}
lengths = {
    0: len(uri_payload),
    1: len(gnome_payload),
}

@GtkClipboardGetFunc
def on_get(_clipboard, selection_data, info, _user_data):
    buffer = buffers.get(info)
    target_atom = target_atoms.get(info)
    if buffer is None or target_atom is None:
        return
    gtk.gtk_selection_data_set(
        selection_data,
        target_atom,
        8,
        ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)),
        lengths[info],
    )

@GtkClipboardClearFunc
def on_clear(_clipboard, _user_data):
    gtk.gtk_main_quit()

clipboard_atom = gdk.gdk_atom_intern_static_string(b"${X11_CLIPBOARD_ATOM}")
clipboard = gtk.gtk_clipboard_get(clipboard_atom)
if not clipboard:
    raise RuntimeError("Failed to resolve X11 clipboard")

if not gtk.gtk_clipboard_set_with_data(
    clipboard,
    targets,
    len(target_atoms),
    on_get,
    on_clear,
    None,
):
    raise RuntimeError("Failed to claim X11 clipboard ownership")

gtk.gtk_clipboard_set_can_store(clipboard, targets, len(target_atoms))
gtk.gtk_clipboard_store(clipboard)
signal.signal(signal.SIGINT, lambda *_args: gtk.gtk_main_quit())
signal.signal(signal.SIGTERM, lambda *_args: gtk.gtk_main_quit())
gtk.gtk_main()
`;

export interface LinuxX11GtkBackendDeps {
  runCommand(call: CommandCall): Promise<CommandResult>;
  startCommand(
    call: CommandCall,
    options?: StartCommandOptions,
  ): Promise<CommandResult>;
}

export function buildLinuxX11GtkProbeCall(): CommandCall {
  return {
    command: GTK_HELPER_COMMAND,
    args: ["-c", GTK_PROBE_SCRIPT],
  };
}

export function buildLinuxX11GtkHelperInput(fileUris: string[]): string {
  return JSON.stringify({
    uri_payload: buildUriListPayload(fileUris),
    gnome_payload: buildGnomeCopiedFilesPayload(fileUris),
  });
}

export function buildLinuxX11GtkClipboardCommand(
  payload: ClipboardPayload,
): CommandCall {
  return {
    command: GTK_HELPER_COMMAND,
    args: ["-u", "-c", GTK_CLIPBOARD_OWNER_SCRIPT],
    stdinText: buildLinuxX11GtkHelperInput(payload.fileUris),
  };
}

export function createLinuxX11GtkBackend(
  deps: LinuxX11GtkBackendDeps,
): ClipboardBackend {
  return {
    id: "linux-x11-gtk-file-copy",
    priority: 100,
    isAvailable: async (payload) => {
      if (!payload.fileUris.length) {
        return {
          available: false,
          reason: "No file URIs to copy.",
        };
      }

      const probeResult = await deps.runCommand(buildLinuxX11GtkProbeCall());
      if (!probeResult.ok) {
        return {
          available: false,
          dependency: GTK_HELPER_DEPENDENCY,
          reason: GTK_HELPER_REASON,
        };
      }

      return {
        available: true,
      };
    },
    write: async (payload) => {
      const result = await deps.startCommand(
        buildLinuxX11GtkClipboardCommand(payload),
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

function buildUriListPayload(fileUris: string[]): string {
  return `${fileUris.join("\r\n")}\r\n`;
}

function buildGnomeCopiedFilesPayload(fileUris: string[]): string {
  return `copy\n${fileUris.join("\n")}`;
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
