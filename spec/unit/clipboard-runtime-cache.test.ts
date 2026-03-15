import assert from "node:assert/strict";
import test from "node:test";

import { createCommandRunner } from "../../src/modules/copy/clipboard/commandRunner";
import { createClipboardRuntimeCache } from "../../src/modules/copy/clipboard/runtimeCache";

test("clipboard runtime cache reuses command availability until invalidated", async () => {
  const cache = createClipboardRuntimeCache();
  let commandCalls = 0;

  const first = await cache.getCommandAvailability("wl-copy", async () => {
    commandCalls += 1;
    return true;
  });
  const second = await cache.getCommandAvailability("wl-copy", async () => {
    commandCalls += 1;
    return false;
  });

  cache.invalidateCommandAvailability("wl-copy");

  const third = await cache.getCommandAvailability("wl-copy", async () => {
    commandCalls += 1;
    return false;
  });

  assert.equal(first, true);
  assert.equal(second, true);
  assert.equal(third, false);
  assert.equal(commandCalls, 2);
});

test("clipboard runtime cache reuses the GTK probe result until invalidated", async () => {
  const cache = createClipboardRuntimeCache();
  let gtkCalls = 0;

  const first = await cache.getLinuxGtkAvailability(async () => {
    gtkCalls += 1;
    return true;
  });
  const second = await cache.getLinuxGtkAvailability(async () => {
    gtkCalls += 1;
    return false;
  });

  cache.invalidateLinuxGtkAvailability();

  const third = await cache.getLinuxGtkAvailability(async () => {
    gtkCalls += 1;
    return false;
  });

  assert.equal(first, true);
  assert.equal(second, true);
  assert.equal(third, false);
  assert.equal(gtkCalls, 2);
});

test("command runner caches resolved command paths across repeated probes and runs", async () => {
  let executableChecks = 0;

  const runner = createCommandRunner({
    getEnv: () => "/bin:/usr/bin",
    isExecutablePath: (path) => {
      executableChecks += 1;
      return path === "/usr/bin/wl-copy";
    },
    runProcess: async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }),
  });

  const firstProbe = await runner.probeCommand("wl-copy");
  const secondProbe = await runner.probeCommand("wl-copy");
  const runResult = await runner.runCommand({
    command: "wl-copy",
    args: ["--type", "text/uri-list"],
  });

  assert.equal(firstProbe, true);
  assert.equal(secondProbe, true);
  assert.equal(runResult.ok, true);
  assert.equal(executableChecks, 2);
});
