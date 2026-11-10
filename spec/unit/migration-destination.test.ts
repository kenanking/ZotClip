import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { posix } from "node:path";
import {
  planImport,
  type Collection,
} from "../../src/modules/migration/service";

const notFound = { result: 0x80520012 };
const source: Collection = {
  manifest: {
    format: 1,
    createdAt: new Date().toISOString(),
    source: { zotero: "10.0.1", zotclip: "fixture", platform: "Linux" },
    entries: [
      { kind: "file", category: "locate", path: "nested/config.json", size: 2 },
    ],
    omitted: [],
  },
  files: new Map([["locate/nested/config.json", "/staged/config.json"]]),
};
const globals = globalThis as any;
let saved: Record<string, PropertyDescriptor | undefined>;
let inspect: (path: string) => boolean;

beforeEach(() => {
  saved = Object.fromEntries(
    ["Zotero", "PathUtils", "Components", "IOUtils"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globals, key),
    ]),
  );
  inspect = () => false;
  Object.assign(globals, {
    Zotero: {
      DataDirectory: { dir: "/data" },
      File: {
        pathToFile: (path: string) => ({ isSymlink: () => inspect(path) }),
      },
    },
    PathUtils: { join: posix.join },
    Components: { results: { NS_ERROR_FILE_NOT_FOUND: notFound.result } },
    IOUtils: {
      exists: async () => false,
      computeHexDigest: async () => "incoming-file-digest",
    },
  });
});

afterEach(() => {
  for (const [key, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(globals, key, descriptor);
    else delete globals[key];
  }
});

for (const missing of [
  "/data/locate/nested",
  "/data/locate/nested/config.json",
]) {
  test(`migration previews new files when Unix reports a missing path: ${missing}`, async () => {
    inspect = (path) => {
      if (path.startsWith(missing)) throw notFound;
      return false;
    };
    const rows = await planImport(source);
    assert.equal(rows[0].status, "add");
    assert.equal(rows[0].selected, true);
  });
}

test("migration rejects dangling symlinks even when their targets do not exist", async () => {
  inspect = (path) => path === "/data/locate/nested";
  await assert.rejects(planImport(source), /migration-unsafe-path/);
});

test("migration propagates filesystem errors other than a missing path", async () => {
  const denied = { result: 0x80520015 };
  inspect = () => {
    throw denied;
  };
  await assert.rejects(planImport(source), (error) => error === denied);
});
