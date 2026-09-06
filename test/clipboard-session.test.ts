import {
  initializeClipboardSession,
  prepareResolvedAttachments,
} from "../src/modules/copy/preparedAttachments";
import type { ResolvedAttachment } from "../src/modules/copy/types";

describe("clipboard session files", function () {
  it("removes previous-session files and retains current-session duplicate copies", async function () {
    const stale = PathUtils.join(
      PathUtils.profileDir,
      "zotclip-clipboard",
      "session-1",
    );
    await IOUtils.makeDirectory(stale, { createAncestors: true });
    await IOUtils.writeUTF8(PathUtils.join(stale, "old.pdf"), "old fixture");
    const session = await initializeClipboardSession();
    assert.equal(await IOUtils.exists(stale), false);
    const source = PathUtils.join(
      Zotero.getTempDirectory().path,
      "zotclip-duplicate.pdf",
    );
    await IOUtils.writeUTF8(source, "duplicate fixture");
    try {
      const result = await prepareResolvedAttachments([
        { path: source },
        { path: source },
      ] as ResolvedAttachment[]);
      assert.ok(result.tempDir?.startsWith(session));
      assert.notEqual(
        result.files[0].clipboardPath,
        result.files[1].clipboardPath,
      );
      assert.equal(
        await IOUtils.readUTF8(result.files[1].clipboardPath!),
        "duplicate fixture",
      );
      assert.equal(await initializeClipboardSession(), session);
      assert.equal(await IOUtils.exists(result.files[1].clipboardPath!), true);
      const mode = (await IOUtils.stat(result.tempDir!)).permissions;
      assert.equal(
        mode & 0o077,
        0,
        "Temporary attachment directory must be private",
      );
    } finally {
      await IOUtils.remove(source, { ignoreAbsent: true });
    }
  });
});
