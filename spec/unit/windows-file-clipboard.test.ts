import assert from "node:assert/strict";
import test from "node:test";

import { buildDropFilesPayload } from "../../src/modules/copy/windowsFileClipboard";

const DROPFILES_HEADER_SIZE = 20;
const WIDE_FLAG_OFFSET = 16;

test("buildDropFilesPayload encodes a single Windows path as CF_HDROP data", () => {
  const payload = buildDropFilesPayload(["C:\\Docs\\a.pdf"]);

  assert.equal(payload[0], DROPFILES_HEADER_SIZE);
  assert.equal(payload[1], 0);
  assert.equal(payload[2], 0);
  assert.equal(payload[3], 0);
  assert.equal(payload[WIDE_FLAG_OFFSET], 1);
  assert.equal(payload[WIDE_FLAG_OFFSET + 1], 0);
  assert.equal(payload[WIDE_FLAG_OFFSET + 2], 0);
  assert.equal(payload[WIDE_FLAG_OFFSET + 3], 0);
  assert.equal(
    decodeUtf16Le(payload.slice(DROPFILES_HEADER_SIZE)),
    "C:\\Docs\\a.pdf\u0000\u0000",
  );
});

test("buildDropFilesPayload encodes multiple Windows paths with separators and a double terminator", () => {
  const payload = buildDropFilesPayload([
    "C:\\Docs\\a.pdf",
    "D:\\Papers\\b.pdf",
  ]);

  assert.equal(
    decodeUtf16Le(payload.slice(DROPFILES_HEADER_SIZE)),
    "C:\\Docs\\a.pdf\u0000D:\\Papers\\b.pdf\u0000\u0000",
  );
});

function decodeUtf16Le(buffer: Uint8Array): string {
  let result = "";

  for (let index = 0; index < buffer.length; index += 2) {
    result += String.fromCharCode(buffer[index] | (buffer[index + 1] << 8));
  }

  return result;
}
