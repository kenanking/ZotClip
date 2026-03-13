import assert from "node:assert/strict";
import test from "node:test";

import {
  createCommandRunner,
  runSubprocessCall,
  startSubprocessCall,
} from "../../src/modules/copy/clipboard/commandRunner";

test("command runner passes stdin text to the low-level process call", async () => {
  const calls: any[] = [];
  const runner = createCommandRunner({
    getEnv: () => {
      throw new Error("explicit paths should not read PATH");
    },
    isExecutablePath: (path) => path === "/bin/sh",
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
    getEnv: () => {
      throw new Error("explicit paths should not read PATH");
    },
    isExecutablePath: (path) => path === "/bin/sh",
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

test("command runner probeCommand resolves commands from PATH without shelling out", async () => {
  const checkedPaths: string[] = [];
  const runner = createCommandRunner({
    getEnv: (name) => (name === "PATH" ? "/opt/bin:/usr/bin" : undefined),
    isExecutablePath: (path) => {
      checkedPaths.push(path);
      return path === "/usr/bin/xclip";
    },
    runProcess: async () => {
      throw new Error("probeCommand should not spawn a process");
    },
  });

  assert.equal(await runner.probeCommand("xclip"), true);
  assert.deepEqual(checkedPaths, ["/opt/bin/xclip", "/usr/bin/xclip"]);
});

test("command runner probeCommand checks explicit command paths directly", async () => {
  const runner = createCommandRunner({
    getEnv: () => {
      throw new Error("explicit paths should not read PATH");
    },
    isExecutablePath: (path) => path === "/usr/bin/xclip",
  });

  assert.equal(await runner.probeCommand("/usr/bin/xclip"), true);
});

test("command runner runCommand resolves command names from PATH before spawning", async () => {
  const calls: any[] = [];
  const runner = createCommandRunner({
    getEnv: (name) => (name === "PATH" ? "/opt/bin:/usr/bin" : undefined),
    isExecutablePath: (path) => path === "/usr/bin/xclip",
    runProcess: async (call) => {
      calls.push(call);
      return {
        exitCode: 0,
        stdout: "",
        stderr: "",
      };
    },
  });

  const result = await runner.runCommand({
    command: "xclip",
    args: ["-selection", "clipboard", "-i"],
    stdinText: "hello",
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].command, "/usr/bin/xclip");
});

test("command runner startCommand resolves command names from PATH before spawning", async () => {
  const calls: any[] = [];
  let resolveWait: ((value: { exitCode: number }) => void) | undefined;
  const waitPromise = new Promise<{ exitCode: number }>((resolve) => {
    resolveWait = resolve;
  });
  const runner = createCommandRunner({
    getEnv: (name) => (name === "PATH" ? "/opt/bin:/usr/bin" : undefined),
    isExecutablePath: (path) => path === "/usr/bin/python3",
    startProcess: async (call) => {
      calls.push(call);
      return {
        stdin: {
          write: async () => {},
          close: async () => {},
        },
        stdout: {
          readString: async () => "",
        },
        stderr: {
          readString: async () => "",
        },
        wait: async () => waitPromise,
      };
    },
  });

  const result = await runner.startCommand(
    {
      command: "python3",
      args: ["-u", "-c", "print('ready')"],
      stdinText: "{}",
    },
    { startupTimeoutMs: 1 },
  );

  assert.equal(result.ok, true);
  assert.equal(calls[0].command, "/usr/bin/python3");
  resolveWait?.({ exitCode: 0 });
});

test("runSubprocessCall writes stdin text into the subprocess pipe", async () => {
  const writes: string[] = [];
  const closings: string[] = [];

  const result = await runSubprocessCall(
    {
      call: async () => ({
        stdin: {
          write: async (value: string) => {
            writes.push(value);
          },
          close: async () => {
            closings.push("closed");
          },
        },
        stdout: {
          readString: async () => "stdout",
        },
        stderr: {
          readString: async () => "",
        },
        wait: async () => ({
          exitCode: 0,
        }),
      }),
    } as any,
    {
      command: "/usr/bin/xclip",
      args: ["-selection", "clipboard", "-i"],
      stdinText: "file:///tmp/a.pdf\r\n",
    },
  );

  assert.deepEqual(writes, ["file:///tmp/a.pdf\r\n"]);
  assert.deepEqual(closings, ["closed"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "stdout");
});

test("startSubprocessCall reports failure when the process exits before startup completes", async () => {
  const result = await startSubprocessCall(
    {
      call: async () => ({
        stdin: {
          write: async () => {},
          close: async () => {},
        },
        stdout: {
          readString: async () => "",
        },
        stderr: {
          readString: async () => "import failed",
        },
        wait: async () => ({
          exitCode: 1,
        }),
      }),
    } as any,
    {
      command: "/usr/bin/python3",
      args: ["-u", "-c", "raise SystemExit(1)"],
      stdinText: "{}",
    },
    {
      startupTimeoutMs: 10,
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /import failed/);
});
