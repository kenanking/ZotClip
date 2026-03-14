import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildLinuxGtkClipboardCommand,
  buildLinuxGtkProbeCall,
  createLinuxGtkBackend,
} from "../../src/modules/copy/clipboard/linuxGtkBackend";

const samplePayload = {
  paths: ["/home/user/a.pdf"],
  fileUris: ["file:///home/user/a.pdf"],
  pathText: "/home/user/a.pdf",
  operation: "copy" as const,
  source: "library" as const,
};

test("buildLinuxGtkProbeCall checks GTK4 availability", () => {
  assert.deepEqual(buildLinuxGtkProbeCall(), {
    command: "python3",
    args: [
      "-c",
      'import gi; gi.require_version("Gtk", "4.0"); gi.require_version("Gdk", "4.0"); from gi.repository import Gtk, Gdk; initialized = Gtk.init_check(); raise SystemExit(0 if initialized and Gdk.Display.get_default() is not None else 1)',
    ],
  });
});

test("buildLinuxGtkClipboardCommand targets the packaged helper script", () => {
  const command = buildLinuxGtkClipboardCommand(samplePayload);

  assert.equal(command.command, "python3");
  assert.match(command.args[0], /linux_clipboard_helper\.py$/);
  assert.match(command.stdinText || "", /"gnome_payload":/);
});

test("linux GTK backend starts the helper after a successful probe", async () => {
  const backend = createLinuxGtkBackend({
    runCommand: async () => ({
      ok: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
    }),
    startCommand: async () => ({
      ok: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
    }),
  });

  assert.deepEqual(await backend.isAvailable(samplePayload), {
    available: true,
  });
  assert.equal((await backend.write(samplePayload)).ok, true);
});

test("linux GTK helper script initializes GTK before reading the display", () => {
  const helperScript = readFileSync(
    "addon/content/helpers/linux_clipboard_helper.py",
    "utf8",
  );

  assert.match(helperScript, /gi\.require_version\("Gdk", "4\.0"\)/);
  assert.match(helperScript, /initialized\s*=\s*Gtk\.init_check\(\)/);
  assert.match(helperScript, /if not initialized:/);
  assert.match(helperScript, /display = Gdk\.Display\.get_default\(\)/);
});
