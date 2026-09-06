import assert from "node:assert/strict";
import test from "node:test";
import {
  createCredentialStore,
  credentialIdentity,
} from "../../src/modules/tagging/credentials/credentialStore";

function fixture() {
  const values = new Map<string, string>();
  const store = createCredentialStore({
    read: async (key) => values.get(key) || "",
    write: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  });
  return { store, values };
}

test("credentials are isolated by provider and origin", async () => {
  const { store } = fixture();
  const a = credentialIdentity(
    "custom",
    "https://one.test/v1/chat/completions",
  );
  await store.write(a, "secret");
  assert.equal(
    await store.read(credentialIdentity("custom", "https://one.test/other")),
    "secret",
  );
  assert.equal(
    await store.read(credentialIdentity("custom", "https://two.test/v1")),
    "",
  );
  assert.equal(
    await store.read(credentialIdentity("deepseek", "https://one.test")),
    "",
  );
  assert.throws(() =>
    credentialIdentity("custom", "https://user:secret@one.test"),
  );
});

test("migration verifies storage before clearing legacy and is idempotent", async () => {
  const { store, values } = fixture();
  let clear = 0;
  await store.migrate("a", "old", () => {
    assert.equal(values.get("a"), "old");
    clear++;
  });
  await store.write("a", "new");
  await store.migrate("a", "old", () => {
    clear++;
  });
  assert.equal(await store.read("a"), "new");
  assert.equal(clear, 2);
  await store.write("a", "");
  assert.equal(await store.read("a"), "");
});

test("failed verification keeps legacy and allows retry", async () => {
  let working = false,
    saved = "",
    cleared = false;
  const store = createCredentialStore({
    read: async () => (working ? saved : ""),
    write: async (_, value) => {
      saved = value;
    },
    remove: async () => {},
  });
  await assert.rejects(
    store.migrate("a", "secret", () => {
      cleared = true;
    }),
  );
  assert.equal(cleared, false);
  working = true;
  await store.migrate("a", "secret", () => {
    cleared = true;
  });
  assert.equal(cleared, true);
});
