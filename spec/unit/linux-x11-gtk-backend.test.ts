import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLinuxX11GtkClipboardCommand,
  buildLinuxX11GtkHelperInput,
  buildLinuxX11GtkProbeCall,
  createLinuxX11GtkBackend,
} from "../../src/modules/copy/clipboard/linuxX11GtkBackend";

const samplePayload = {
  paths: ["/home/user/a.pdf"],
  fileUris: ["file:///home/user/a.pdf"],
  pathText: "/home/user/a.pdf",
  operation: "copy" as const,
  source: "library" as const,
};

test("buildLinuxX11GtkHelperInput uses URI-list and GNOME payloads", () => {
  assert.deepEqual(
    JSON.parse(
      buildLinuxX11GtkHelperInput([
        "file:///home/user/A.pdf",
        "file:///home/user/B.epub",
      ]),
    ),
    {
      uri_payload: "file:///home/user/A.pdf\r\nfile:///home/user/B.epub\r\n",
      gnome_payload: "copy\nfile:///home/user/A.pdf\nfile:///home/user/B.epub",
    },
  );
});

test("buildLinuxX11GtkProbeCall probes python GTK clipboard support", () => {
  assert.deepEqual(buildLinuxX11GtkProbeCall(), {
    command: "python3",
    args: [
      "-c",
      'import gi; gi.require_version("Gtk", "3.0"); from gi.repository import Gtk, Gdk; raise SystemExit(0 if Gdk.Display.get_default() is not None else 1)',
    ],
  });
});

test("buildLinuxX11GtkClipboardCommand launches the clipboard owner helper", () => {
  const command = buildLinuxX11GtkClipboardCommand(samplePayload);

  assert.equal(command.command, "python3");
  assert.equal(command.args[0], "-u");
  assert.equal(command.args[1], "-c");
  assert.match(command.args[2], /gtk_clipboard_set_with_data/);
  assert.match(command.args[2], /ctypes\.CFUNCTYPE/);
  assert.match(command.args[2], /GtkTargetEntry/);
  assert.match(command.stdinText || "", /"gnome_payload":/);
});

test("linux x11 gtk backend starts the helper when the GTK probe succeeds", async () => {
  const probeCalls: any[] = [];
  const startCalls: any[] = [];
  const backend = createLinuxX11GtkBackend({
    runCommand: async (call) => {
      probeCalls.push(call);
      return { ok: true, exitCode: 0, stdout: "", stderr: "" };
    },
    startCommand: async (call) => {
      startCalls.push(call);
      return { ok: true, exitCode: 0, stdout: "", stderr: "" };
    },
  });

  const availability = await backend.isAvailable(samplePayload);
  const result = await backend.write(samplePayload);

  assert.equal(availability.available, true);
  assert.equal(probeCalls.length, 1);
  assert.equal(startCalls.length, 1);
  assert.equal(startCalls[0].command, "python3");
  assert.equal(result.ok, true);
  assert.equal(result.outcome, "copied-files");
  assert.equal(result.format, "file-uri-list");
});

test("linux x11 gtk backend reports a GTK dependency when the probe fails", async () => {
  const backend = createLinuxX11GtkBackend({
    runCommand: async () => ({
      ok: false,
      exitCode: 1,
      stdout: "",
      stderr: "gi import failed",
    }),
    startCommand: async () => {
      throw new Error("startCommand should not be called");
    },
  });

  assert.deepEqual(await backend.isAvailable(samplePayload), {
    available: false,
    dependency: "python3-gi",
    reason: "Install python3-gi to enable file copy on X11.",
  });
});
