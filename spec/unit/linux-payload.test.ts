import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLinuxClipboardPayload,
  buildLinuxClipboardPayloadInput,
} from "../../src/modules/copy/clipboard/linuxPayload";

test("buildLinuxClipboardPayload creates both Linux MIME payloads", () => {
  const payload = buildLinuxClipboardPayload([
    "file:///home/user/A.pdf",
    "file:///home/user/B%20File.epub",
  ]);

  assert.equal(
    payload.uriListText,
    "file:///home/user/A.pdf\r\nfile:///home/user/B%20File.epub\r\n",
  );
  assert.equal(
    payload.gnomeCopiedFilesText,
    "copy\nfile:///home/user/A.pdf\nfile:///home/user/B%20File.epub",
  );
});

test("buildLinuxClipboardPayloadInput serializes helper JSON input", () => {
  assert.deepEqual(
    JSON.parse(buildLinuxClipboardPayloadInput(["file:///home/user/A.pdf"])),
    {
      uri_payload: "file:///home/user/A.pdf\r\n",
      gnome_payload: "copy\nfile:///home/user/A.pdf",
    },
  );
});
