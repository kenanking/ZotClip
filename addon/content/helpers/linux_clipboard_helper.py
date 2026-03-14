import json
import signal
import sys

import gi

gi.require_version("Gtk", "4.0")

from gi.repository import Gdk, GLib


def main() -> int:
    payload = json.load(sys.stdin)
    display = Gdk.Display.get_default()
    if display is None:
        raise RuntimeError("Display unavailable")

    clipboard = display.get_clipboard()
    uri_bytes = GLib.Bytes.new(payload["uri_payload"].encode("utf-8"))
    gnome_bytes = GLib.Bytes.new(payload["gnome_payload"].encode("utf-8"))
    provider = Gdk.ContentProvider.new_union(
        [
            Gdk.ContentProvider.new_for_bytes("text/uri-list", uri_bytes),
            Gdk.ContentProvider.new_for_bytes(
                "x-special/gnome-copied-files",
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
