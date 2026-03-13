import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProbeCommand,
  createCommandRunner,
} from "../../src/modules/copy/clipboard/commandRunner";

test("buildProbeCommand uses command -v on POSIX", () => {
  assert.deepEqual(buildProbeCommand("wl-copy"), {
    command: "/bin/sh",
    args: ["-lc", "command -v -- wl-copy"],
  });
});

test("command runner passes stdin text to the low-level process call", async () => {
  const calls: any[] = [];
  const runner = createCommandRunner({
    runProcess: async (call) => {
      calls.push(call);
      return {
        exitCode: 0,
        stdout: "ok",
        stderr: "",
      };
    },
  });

  const result = await runner.runCommand({
    command: "/bin/sh",
    args: ["-lc", "cat"],
    stdinText: "hello",
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].stdinText, "hello");
});

test("command runner probeCommand returns false when the probe exits non-zero", async () => {
  const runner = createCommandRunner({
    runProcess: async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "",
    }),
  });

  assert.equal(await runner.probeCommand("missing-command"), false);
});

test("command runner returns a failed result when the process call throws", async () => {
  const runner = createCommandRunner({
    runProcess: async () => {
      throw new Error("spawn failed");
    },
  });

  assert.equal(await runner.probeCommand("wl-copy"), false);

  const result = await runner.runCommand({
    command: "/bin/sh",
    args: ["-lc", "cat"],
    stdinText: "hello",
  });

  assert.equal(result.ok, false);
  assert.equal(result.exitCode, -1);
  assert.match(result.stderr, /spawn failed/);
});
