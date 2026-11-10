import assert from "node:assert/strict";
import test from "node:test";
import { protectWindowsClipboardDirectory } from "../../src/modules/copy/windowsTempPermissions";
import {
  initializeClipboardSession,
  prepareResolvedAttachments,
} from "../../src/modules/copy/preparedAttachments";

test("ACL failure stops clipboard preparation before a duplicate file can be copied", async () => {
  const path = "C:\\fixture\\副本 '$([unsafe])'";
  let argumentsSent: string[] = [];
  let stdin = "";
  let copied = false;
  Object.assign(globalThis, {
    Zotero: { isWin: true },
    PathUtils: {
      profileDir: "C:/fixture",
      join: (...parts: string[]) => parts.join("/"),
      filename: (p: string) => p.split("/").pop(),
    },
    Services: {
      env: { get: () => "C:/Windows" },
      startup: { getStartupInfo: () => ({ process: new Date(1) }) },
    },
    IOUtils: {
      makeDirectory: async () => {},
      copy: async () => {
        copied = true;
      },
    },
    ChromeUtils: {
      importESModule: () => ({
        Subprocess: {
          call: async (options: { arguments: string[] }) => {
            argumentsSent = options.arguments;
            return {
              stdin: {
                write: async (text: string) => {
                  stdin = text;
                },
                close: async () => {},
              },
              wait: async () => ({ exitCode: 1 }),
              stdout: { readString: async () => "" },
              stderr: { readString: async () => "fixture failure" },
            };
          },
        },
      }),
    },
  });
  await assert.rejects(
    protectWindowsClipboardDirectory(path),
    /Could not secure/,
  );
  assert.equal(stdin, JSON.stringify(path));
  assert.equal(
    argumentsSent.some((argument) => argument.includes(path)),
    false,
    "Paths are data, never executable PowerShell text",
  );
  await assert.rejects(initializeClipboardSession(), /Could not secure/);
  await assert.rejects(
    prepareResolvedAttachments([
      { path: "a/file.pdf" },
      { path: "b/file.pdf" },
    ] as any),
    /Could not secure/,
  );
  assert.equal(copied, false);
});
