import type { FileEntry, Manifest, PackageIO, Progress } from "./types";
import { MAX_PACKAGE_BYTES, validateManifest } from "./policy";

const MAGIC = new Uint8Array([90, 79, 84, 67, 76, 73, 80, 2]);
export const HEADER_BYTES = 37;
const ITERATIONS = 600000;
const MAX_MANIFEST = 4 * 1024 * 1024;

function integer(value: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}
function join(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
async function keyFromPassword(
  crypto: Crypto,
  password: string,
  header: Uint8Array<ArrayBuffer>,
) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: header.slice(9, 25),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
function parameters(header: Uint8Array, index: number) {
  return {
    name: "AES-GCM",
    iv: join(header.slice(25, 33), integer(index)),
    additionalData: join(header, integer(index)),
    tagLength: 128,
  };
}

export function packageIsEncrypted(header: Uint8Array): boolean {
  if (
    header.length !== HEADER_BYTES ||
    !MAGIC.every((byte, i) => header[i] === byte) ||
    ![0, 1].includes(header[8]) ||
    (header[8] === 1
      ? new DataView(
          header.buffer,
          header.byteOffset,
          header.byteLength,
        ).getUint32(33) !== ITERATIONS
      : header.slice(9).some((byte) => byte !== 0))
  )
    throw new Error("migration-invalid-package");
  return header[8] === 1;
}

export async function writePackage(
  crypto: Crypto,
  password: string | undefined,
  manifest: Manifest,
  readFile: (entry: FileEntry) => Promise<Uint8Array<ArrayBuffer>>,
  append: (bytes: Uint8Array<ArrayBuffer>) => Promise<void>,
  signal?: AbortSignal,
  progress: Progress = () => {},
): Promise<void> {
  validateManifest(manifest);
  if (password !== undefined && password.length < 10)
    throw new Error("migration-password-short");
  const metadata = new TextEncoder().encode(JSON.stringify(manifest));
  if (metadata.length > MAX_MANIFEST) throw new Error("migration-too-large");
  const salt = new Uint8Array(16);
  const nonce = new Uint8Array(8);
  const encrypted = password !== undefined;
  if (encrypted) {
    crypto.getRandomValues(salt);
    crypto.getRandomValues(nonce);
  }
  const header = join(
    MAGIC,
    new Uint8Array([Number(encrypted)]),
    salt,
    nonce,
    integer(encrypted ? ITERATIONS : 0),
  );
  const key =
    password === undefined
      ? undefined
      : await keyFromPassword(crypto, password, header);
  signal?.throwIfAborted();
  await append(header);
  let index = 0;
  let size = header.length;
  const files = manifest.entries.filter(
    (e): e is FileEntry => e.kind === "file",
  );
  const write = async (plain: Uint8Array<ArrayBuffer>) => {
    signal?.throwIfAborted();
    const record = key
      ? new Uint8Array(
          await crypto.subtle.encrypt(parameters(header, index), key, plain),
        )
      : join(
          plain,
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              join(header, integer(index), plain),
            ),
          ),
        );
    index++;
    size += record.length + 4;
    if (size > MAX_PACKAGE_BYTES) throw new Error("migration-too-large");
    await append(integer(record.length));
    await append(record);
    progress(index - 1, files.length);
  };
  await write(metadata);
  for (const file of files) {
    const bytes = file.remove ? new Uint8Array() : await readFile(file);
    if (bytes.length !== file.size) throw new Error("migration-source-changed");
    await write(bytes);
  }
}

export async function readPackage(
  crypto: Crypto,
  password: string | undefined,
  input: PackageIO,
  stageFile: (
    entry: FileEntry,
    bytes: Uint8Array<ArrayBuffer>,
  ) => Promise<void>,
  signal?: AbortSignal,
  progress: Progress = () => {},
): Promise<Manifest> {
  if (input.size > MAX_PACKAGE_BYTES || input.size < HEADER_BYTES + 20)
    throw new Error("migration-invalid-package");
  let offset = 0;
  const read = async (size: number) => {
    signal?.throwIfAborted();
    if (offset + size > input.size)
      throw new Error("migration-invalid-package");
    const bytes = await input.read(offset, size);
    if (bytes.length !== size) throw new Error("migration-invalid-package");
    offset += size;
    return bytes;
  };
  const header = await read(HEADER_BYTES);
  const encrypted = packageIsEncrypted(header);
  if (encrypted && !password) throw new Error("migration-password-required");
  const key = encrypted
    ? await keyFromPassword(crypto, password!, header)
    : undefined;
  const overhead = encrypted ? 16 : 32;
  let index = 0;
  const readRecord = async (expectedSize: number, exact: boolean) => {
    const length = new DataView((await read(4)).buffer).getUint32(0);
    if (
      length < overhead ||
      length > expectedSize + overhead ||
      (exact && length !== expectedSize + overhead)
    )
      throw new Error("migration-invalid-package");
    const bytes = await read(length);
    if (!key) {
      const plain = bytes.slice(0, -32);
      const checksum = new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          join(header, integer(index++), plain),
        ),
      );
      if (!checksum.every((byte, i) => byte === bytes[plain.length + i]))
        throw new Error("migration-invalid-package");
      return plain;
    }
    try {
      return new Uint8Array(
        await crypto.subtle.decrypt(parameters(header, index++), key, bytes),
      );
    } catch {
      throw new Error("migration-decrypt-failed");
    }
  };
  let manifest: unknown;
  const metadata = await readRecord(MAX_MANIFEST, false);
  try {
    manifest = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(metadata),
    );
  } catch {
    throw new Error("migration-invalid-package");
  }
  validateManifest(manifest);
  const files = manifest.entries.filter(
    (e): e is FileEntry => e.kind === "file",
  );
  for (const file of files) {
    const bytes = await readRecord(file.size, true);
    await stageFile(file, bytes);
    progress(index - 1, files.length);
  }
  if (offset !== input.size) throw new Error("migration-invalid-package");
  return manifest;
}
