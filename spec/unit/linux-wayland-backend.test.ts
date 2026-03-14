import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLinuxWaylandClipboardCall,
  createLinuxWaylandBackend,
} from "../../src/modules/copy/clipboard/linuxWaylandBackend";

const samplePayload = {
  paths: ["/home/user/a.pdf"],
  fileUris: ["file:///home/user/a.pdf"],
  pathText: "/home/user/a.pdf",
  operation: "copy" as const,
  source: "library" as const,
};

test("buildLinuxWaylandClipboardCall targets wl-copy with a URI list payload", () => {
  assert.deepEqual(buildLinuxWaylandClipboardCall(samplePayload), {
    command: "wl-copy",
    args: ["--type", "text/uri-list"],
    stdinText: "file:///home/user/a.pdf\r\n",
  });
});

test("linux Wayland backend probes wl-copy before writing", async () => {
  const commandCalls: any[] = [];
  const backend = createLinuxWaylandBackend({
    probeCommand: async (name) => name === "wl-copy",
    runCommand: async (call) => {
      commandCalls.push(call);
      return {
        ok: true,
        exitCode: 0,
        stdout: "",
        stderr: "",
      };
    },
  });

  assert.deepEqual(await backend.isAvailable(samplePayload), {
    available: true,
  });
  assert.equal((await backend.write(samplePayload)).ok, true);
  assert.deepEqual(commandCalls, [
    {
      command: "wl-copy",
      args: ["--type", "text/uri-list"],
      stdinText: "file:///home/user/a.pdf\r\n",
    },
  ]);
});
