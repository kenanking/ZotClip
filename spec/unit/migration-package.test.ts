import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { readPackage, writePackage } from "../../src/modules/migration/package";
import {
  isMachinePath,
  portablePreference,
  validateManifest,
  validRelativePath,
} from "../../src/modules/migration/policy";
import type { Manifest } from "../../src/modules/migration/types";

const crypto = webcrypto as unknown as Crypto;
const password = "synthetic-passphrase-only";
function fixture(): Manifest {
  return {
    format: 1,
    recovery: false,
    createdAt: "2026-11-10T00:00:00Z",
    source: { zotero: "11.0-beta.4", zotclip: "0.6.2", platform: "Windows" },
    omitted: [],
    entries: [
      {
        kind: "preference",
        name: "extensions.zotero.zotclip.autoTagOnAdd",
        value: false,
      },
      { kind: "preference", name: "extensions.example.count", value: 0 },
      { kind: "preference", name: "extensions.example.text", value: "" },
      {
        kind: "credential",
        provider: "custom",
        origin: "https://fixture.invalid",
        value: "synthetic-secret",
      },
      { kind: "file", category: "styles", path: "nested/中文.csl", size: 4 },
      { kind: "file", category: "styles", path: "second.csl", size: 4 },
    ],
  };
}
async function encode(manifest = fixture(), signal?: AbortSignal) {
  const chunks: Uint8Array[] = [];
  await writePackage(
    crypto,
    password,
    manifest,
    async () => new Uint8Array([1, 2, 3, 4]),
    async (bytes) => {
      chunks.push(bytes);
    },
    signal,
  );
  return new Uint8Array(Buffer.concat(chunks));
}
async function decode(
  data: Uint8Array,
  key = password,
  stage = async () => {},
) {
  return readPackage(
    crypto,
    key,
    {
      size: data.length,
      read: async (offset, count) =>
        new Uint8Array(data.slice(offset, offset + count)),
    },
    stage,
  );
}

test("encrypted package round trip preserves false, zero, empty strings, credentials and nested paths", async () => {
  const encoded = await encode();
  let files = 0;
  const manifest = await readPackage(
    crypto,
    password,
    {
      size: encoded.length,
      read: async (offset, count) => encoded.slice(offset, offset + count),
    },
    async (_entry, bytes) => {
      assert.deepEqual([...bytes], [1, 2, 3, 4]);
      files++;
    },
  );
  assert.deepEqual(manifest, fixture());
  assert.equal(files, 2);
  assert.equal(
    Buffer.from(encoded).includes(Buffer.from("synthetic-secret")),
    false,
  );
  assert.equal(
    Buffer.from(encoded).includes(Buffer.from("fixture.invalid")),
    false,
  );
  assert.equal(Buffer.from(encoded).includes(Buffer.from("中文.csl")), false);
});
test("wrong password rejects before staging any files", async () => {
  const encoded = await encode();
  let writes = 0;
  await assert.rejects(
    decode(encoded, "wrong-password", async () => {
      writes++;
    }),
    /migration-decrypt-failed/,
  );
  assert.equal(writes, 0);
});
test("modified ciphertext, reordered records, truncation and trailing data are rejected", async () => {
  const encoded = await encode();
  const changed = encoded.slice();
  changed[changed.length - 1] ^= 1;
  await assert.rejects(decode(changed), /migration-decrypt-failed/);
  const manifestLength = new DataView(encoded.buffer).getUint32(36);
  const first = 40 + manifestLength;
  const recordLength = 4 + 4 + 16;
  const swapped = encoded.slice();
  swapped.set(
    encoded.slice(first + recordLength, first + 2 * recordLength),
    first,
  );
  swapped.set(encoded.slice(first, first + recordLength), first + recordLength);
  await assert.rejects(decode(swapped), /migration-decrypt-failed/);
  await assert.rejects(
    decode(encoded.slice(0, -1)),
    /migration-invalid-package/,
  );
  await assert.rejects(
    decode(new Uint8Array([...encoded, 0])),
    /migration-invalid-package/,
  );
});
test("new packages use different salts and cannot swap encrypted records", async () => {
  const first = await encode();
  const second = await encode();
  assert.notDeepEqual(first.slice(8, 32), second.slice(8, 32));
  first.set(second.slice(-20), first.length - 20);
  await assert.rejects(decode(first), /migration-decrypt-failed/);
});
test("invalid headers and excessive declared sizes fail before allocating file buffers", async () => {
  const encoded = await encode();
  new DataView(encoded.buffer).setUint32(32, 0xffffffff);
  await assert.rejects(decode(encoded), /migration-invalid-package/);
  const valid = await encode();
  new DataView(valid.buffer).setUint32(36, 0xffffffff);
  await assert.rejects(decode(valid), /migration-invalid-package/);
});
test("path traversal, absolute paths and case-insensitive duplicate destinations are rejected", () => {
  for (const path of [
    "../outside",
    "/absolute",
    "C:/absolute",
    "safe/../../x",
    "a\\b",
    "a//b",
    "a/./b",
    "CON",
    "a:stream",
    "file. ",
  ])
    assert.equal(validRelativePath(path), false, path);
  assert.equal(validRelativePath("hidden/dependent/中文.csl"), true);
  const manifest = fixture();
  manifest.entries.push({
    kind: "file",
    category: "styles",
    path: "SECOND.CSL",
    size: 1,
  });
  assert.throws(() => validateManifest(manifest), /migration-invalid-package/);
});
test("unsafe preference namespaces and credentials are excluded", () => {
  for (const name of [
    "browser.startup.homepage",
    "extensions.zotero.dataDir",
    "extensions.zotero.useDataDir",
    "extensions.zotero.sync.username",
    "extensions.other.apiKey",
    "extensions.other.password",
    "extensions.zotero.httpServer.enabled",
    "extensions.zotero.zotclip.testXpi",
    "extensions.databaseSchema",
    "extensions.pendingOperations",
    "extensions.webextensions.uuids",
    "extensions.checkCompatibility.nightly",
    "extensions.zotero.purge.items",
    "extensions.zoteroMacWordIntegration.skipInstallation",
  ])
    assert.equal(portablePreference(name), false, name);
  assert.equal(portablePreference("extensions.zotero.zotclip.aiPrompt"), true);
  assert.equal(isMachinePath("extensions.other.output", "D:\\docs"), true);
  assert.equal(isMachinePath("extensions.other.output", "/home/user"), true);
  assert.equal(
    isMachinePath("extensions.other.endpoint", "https://example.invalid"),
    false,
  );
  const manifest = fixture();
  manifest.entries.push({
    kind: "credential",
    provider: "custom",
    origin: "https://user:password@example.invalid",
    value: "x",
  });
  assert.throws(() => validateManifest(manifest));
});
test("destructive recovery entries are accepted only in a recovery package", () => {
  const manifest = fixture();
  manifest.entries.push({
    kind: "file",
    category: "styles",
    path: "new.csl",
    size: 0,
    remove: true,
  });
  assert.throws(() => validateManifest(manifest));
  manifest.recovery = true;
  assert.doesNotThrow(() => validateManifest(manifest));
  manifest.entries.push({
    kind: "preference",
    name: "extensions.example.absent",
    value: null,
  });
  assert.doesNotThrow(() => validateManifest(manifest));
});
test("cancelled exports stop without emitting a package", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(encode(fixture(), controller.signal), {
    name: "AbortError",
  });
});
