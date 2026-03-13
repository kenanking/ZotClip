import assert from "node:assert/strict";
import test from "node:test";

import {
  createLinuxWaylandBackend,
  createLinuxX11Backend,
} from "../../src/modules/copy/clipboard/linuxCommandBackends";

const samplePayload = {
  paths: ["/home/user/a.pdf"],
  fileUris: ["file:///home/user/a.pdf"],
  pathText: "/home/user/a.pdf",
  operation: "copy" as const,
  source: "library" as const,
};

test("linux x11 backend uses xclip with text/uri-list", async () => {
  const calls: any[] = [];
  const backend = createLinuxX11Backend({
    probeCommand: async (name) => name === "xclip",
    runCommand: async (call) => {
      calls.push(call);
      return { ok: true, exitCode: 0, stdout: "", stderr: "" };
    },
  });

  const result = await backend.write(samplePayload);

  assert.equal(result.outcome, "copied-file-uris");
  assert.deepEqual(calls[0].args, [
    "-selection",
    "clipboard",
    "-t",
    "text/uri-list",
    "-silent",
    "-i",
  ]);
});

test("linux wayland backend uses wl-copy with text/uri-list", async () => {
  const calls: any[] = [];
  const backend = createLinuxWaylandBackend({
    probeCommand: async (name) => name === "wl-copy",
    runCommand: async (call) => {
      calls.push(call);
      return { ok: true, exitCode: 0, stdout: "", stderr: "" };
    },
  });

  const result = await backend.write(samplePayload);

  assert.equal(result.outcome, "copied-file-uris");
  assert.deepEqual(calls[0].args, ["--type", "text/uri-list"]);
});

test("linux backends report dependency hints when commands are unavailable", async () => {
  const backend = createLinuxWaylandBackend({
    probeCommand: async () => false,
    runCommand: async () => ({
      ok: false,
      exitCode: 1,
      stdout: "",
      stderr: "",
    }),
  });

  assert.deepEqual(await backend.isAvailable(samplePayload), {
    available: false,
    dependency: "wl-clipboard",
    reason: "Install wl-clipboard to enable file copy on Wayland.",
  });
});
