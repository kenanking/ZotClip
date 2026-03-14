import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMacClipboardScript,
  createMacosCommandBackend,
} from "../../src/modules/copy/clipboard/macosCommandBackend";

const samplePayload = {
  paths: ["/Users/me/A.pdf"],
  fileUris: ["file:///Users/me/A.pdf"],
  pathText: "/Users/me/A.pdf",
  operation: "copy" as const,
  source: "library" as const,
};

test("buildMacClipboardScript creates a Finder clipboard list", () => {
  assert.equal(
    buildMacClipboardScript(["/Users/me/A.pdf", "/Users/me/B.epub"]),
    'tell application "Finder" to set the clipboard to {POSIX file "/Users/me/A.pdf", POSIX file "/Users/me/B.epub"}',
  );
});

test("macOS backend invokes osascript with the generated clipboard script", async () => {
  const calls: any[] = [];
  const backend = createMacosCommandBackend({
    probeCommand: async (name) => name === "osascript",
    runCommand: async (call) => {
      calls.push(call);
      return { ok: true, exitCode: 0, stdout: "", stderr: "" };
    },
  });

  const result = await backend.write(samplePayload);

  assert.equal(result.outcome, "copied-files");
  assert.deepEqual(calls[0], {
    command: "/usr/bin/osascript",
    args: [
      "-e",
      'tell application "Finder" to set the clipboard to {POSIX file "/Users/me/A.pdf"}',
    ],
  });
});

test("macOS backend reports osascript dependency hints when unavailable", async () => {
  const backend = createMacosCommandBackend({
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
    dependency: "osascript",
    reasonKey: "copy-macos-osascript-missing",
  });
});
