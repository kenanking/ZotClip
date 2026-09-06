import assert from "node:assert/strict";
import test from "node:test";
import {
  startSubprocessCall,
  stopClipboardProcesses,
} from "../../src/modules/copy/clipboard/commandRunner";

test("helper must acknowledge readiness and is stopped on shutdown", async () => {
  let killed = 0;
  let exit!: (value: { exitCode: number }) => void;
  const exited = new Promise<{ exitCode: number }>((r) => {
    exit = r;
  });
  const result = await startSubprocessCall(
    {
      call: async () => ({
        stdout: { readString: async () => "ZOTCLIP_READY\n" },
        wait: () => exited,
        kill: () => {
          killed++;
          exit({ exitCode: 0 });
        },
      }),
    },
    { command: "python3", args: [] },
  );
  assert.equal(result.ok, true);
  stopClipboardProcesses();
  stopClipboardProcesses();
  assert.equal(killed, 1);
  await result.process!.exited;
});

test("helper startup timeout kills process instead of claiming success", async () => {
  let killed = false;
  const result = await startSubprocessCall(
    {
      call: async () => ({
        stdout: { readString: () => new Promise<string>(() => {}) },
        wait: () => new Promise<{ exitCode: number }>(() => {}),
        kill: () => {
          killed = true;
        },
      }),
    },
    { command: "python3", args: [] },
    { startupTimeoutMs: 5 },
  );
  assert.equal(result.ok, false);
  assert.equal(killed, true);
});
