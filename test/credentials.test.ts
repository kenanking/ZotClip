import {
  getAiApiKeyForProvider,
  setAiApiKeyForProvider,
} from "../src/modules/tagging/credentials/zoteroCredentials";

describe("credential storage", function () {
  it("saves, replaces and deletes credentials in the real login manager", async function () {
    const endpoint = "https://zotclip-test.invalid/v1/chat/completions";
    try {
      await setAiApiKeyForProvider("custom", "test-only-first", endpoint);
      assert.equal(
        await getAiApiKeyForProvider("custom", endpoint),
        "test-only-first",
      );
      assert.equal(
        await getAiApiKeyForProvider("custom", "https://other.invalid/v1"),
        "",
      );
      await setAiApiKeyForProvider("custom", "test-only-second", endpoint);
      assert.equal(
        await getAiApiKeyForProvider("custom", endpoint),
        "test-only-second",
      );
    } catch (error) {
      (window as any).debug({
        credentialFailure: String(error),
        stack: (error as Error).stack,
      });
      throw error;
    } finally {
      await setAiApiKeyForProvider("custom", "", endpoint);
    }
    assert.equal(await getAiApiKeyForProvider("custom", endpoint), "");
  });
});
