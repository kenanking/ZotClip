import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import process from "node:process";
import console from "node:console";
import { buildLinuxGtkClipboardCommand } from "../src/modules/copy/clipboard/linuxGtkBackend";

// Always use an isolated display: never replace the developer's clipboard.
if (!process.argv.includes("--isolated")) {
  const result = spawnSync(
    "xvfb-run",
    [
      "-a",
      process.execPath,
      "--import",
      "tsx",
      import.meta.filename,
      "--isolated",
    ],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}
const uri = "file:///tmp/zotclip-fixture%20with%20spaces.pdf";
const call = buildLinuxGtkClipboardCommand({
  paths: [],
  fileUris: [uri],
  pathText: "",
  operation: "copy",
  source: "library",
});
const helper = spawn(call.command, call.args, {
  stdio: ["pipe", "pipe", "inherit"],
});
const exited = once(helper, "exit");
helper.stdin.end(call.stdinText);
try {
  let output = "";
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("GTK helper readiness timed out")),
      5000,
    );
    helper.stdout.on("data", (chunk) => {
      output += String(chunk);
      if (output.includes("ZOTCLIP_READY")) {
        clearTimeout(timer);
        resolve();
      }
    });
    helper.on("error", reject);
  });
  console.log("GTK helper READY; checking both MIME types after 61 seconds.");
  await delay(61_000);
  assert.equal(
    helper.exitCode,
    null,
    "Clipboard owner must outlive the former 20-second timeout",
  );
  const reader = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import gi
import sys
gi.require_version("Gtk", "4.0")
from gi.repository import Gtk, Gdk, GLib
Gtk.init()
clipboard = Gdk.Display.get_default().get_clipboard()
loop = GLib.MainLoop()
values = []

def received(source, result, mime):
    stream, actual = source.read_finish(result)
    def read_done(stream, result):
        values.append(stream.read_bytes_finish(result).get_data().decode("utf-8"))
        loop.quit()
    stream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, None, read_done)

for mime in ["text/uri-list", "x-special/gnome-copied-files"]:
    clipboard.read_async([mime], GLib.PRIORITY_DEFAULT, None, received, mime)
    loop.run()
assert sys.argv[1] in values[0], values
assert values[1].startswith("copy\n") and sys.argv[1] in values[1], values
clipboard.set_content(Gdk.ContentProvider.new_for_bytes("text/plain", GLib.Bytes.new(b"replacement")))
GLib.timeout_add(1000, lambda: loop.quit())
loop.run()
print("Read both file MIME types and replaced ownership")
`,
      uri,
    ],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.equal(reader.status, 0, reader.stderr);
  console.log(reader.stdout.trim());
  const timeout = delay(5000).then(() => {
    throw new Error("GTK helper did not exit after ownership changed");
  });
  const [code] = await Promise.race([exited, timeout]);
  assert.equal(code, 0);
  console.log("PASS: delayed clipboard read and ownership cleanup");
} finally {
  if (helper.exitCode === null) helper.kill("SIGTERM");
}
