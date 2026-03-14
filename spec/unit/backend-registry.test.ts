import assert from "node:assert/strict";
import test from "node:test";

import { runClipboardBackends } from "../../src/modules/copy/clipboard/backendRegistry";

test("runClipboardBackends picks the first successful backend by priority", async () => {
  const result = await runClipboardBackends({
    payload: {
      paths: ["C:\\Docs\\a.pdf"],
      fileUris: ["file:///C:/Docs/a.pdf"],
      pathText: "C:\\Docs\\a.pdf",
      operation: "copy",
      source: "library",
    },
    backends: [
      {
        id: "unavailable",
        priority: 100,
        isAvailable: async () => ({ available: false, reason: "missing" }),
        write: async () => {
          throw new Error("should not run");
        },
      },
      {
        id: "fallback",
        priority: 10,
        isAvailable: async () => ({ available: true }),
        write: async () => ({
          ok: true,
          count: 1,
          format: "path-text",
          outcome: "copied-path-text-fallback",
        }),
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.outcome, "copied-path-text-fallback");
});

test("runClipboardBackends skips a backend that throws during write", async () => {
  const result = await runClipboardBackends({
    payload: {
      paths: ["/home/user/a.pdf"],
      fileUris: ["file:///home/user/a.pdf"],
      pathText: "/home/user/a.pdf",
      operation: "copy",
      source: "library",
    },
    backends: [
      {
        id: "throws",
        priority: 100,
        isAvailable: async () => ({ available: true }),
        write: async () => {
          throw new Error("backend exploded");
        },
      },
      {
        id: "fallback",
        priority: 10,
        isAvailable: async () => ({ available: true }),
        write: async () => ({
          ok: true,
          count: 1,
          format: "path-text",
          outcome: "copied-path-text-fallback",
        }),
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.outcome, "copied-path-text-fallback");
});
