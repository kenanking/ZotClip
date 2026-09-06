import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderApiKeyField } from "../../src/modules/tagging/preferences/apiKeyField";

function fixture() {
  const input = { value: "", placeholder: "", title: "" } as HTMLInputElement;
  const status = { textContent: "old error", hidden: false } as HTMLElement;
  const remove = { disabled: false } as HTMLButtonElement;
  return { input, status, remove };
}

test("saved key is described by placeholder without fake input content or a side label", () => {
  const { input, status, remove } = fixture();
  renderApiKeyField(input, status, remove, "saved", (key) => key);
  assert.equal(input.placeholder, "pref-key-saved");
  assert.equal(input.value, "");
  assert.equal(status.textContent, "");
  assert.equal(status.hidden, true);
  assert.equal(remove.disabled, false);
  input.value = "new key being typed";
  renderApiKeyField(input, status, remove, "saved", (key) => key);
  assert.equal(input.value, "new key being typed");
});

test("unset optional providers retain their provider hint and disable deletion", () => {
  const { input, status, remove } = fixture();
  renderApiKeyField(
    input,
    status,
    remove,
    "unset",
    (key) => key,
    "Optional local key",
  );
  assert.equal(input.placeholder, "Optional local key");
  assert.equal(remove.disabled, true);
  renderApiKeyField(input, status, remove, "unset", (key) => key);
  assert.equal(input.placeholder, "pref-key-unset");
});

test("loading and errors never claim that a saved key is absent", () => {
  const { input, status, remove } = fixture();
  renderApiKeyField(input, status, remove, "loading", (key) => key);
  assert.equal(input.placeholder, "pref-key-loading");
  assert.equal(remove.disabled, true);
  renderApiKeyField(input, status, remove, "error", (key) => key);
  assert.equal(input.placeholder, "pref-key-unavailable");
  assert.equal(status.textContent, "pref-key-error");
  assert.equal(status.hidden, false);
});

for (const locale of ["en-US", "zh-CN"]) {
  test(`${locale} defines all dynamic credential messages in the runtime Fluent bundle`, () => {
    const ftl = readFileSync(
      new URL(`../../addon/locale/${locale}/addon.ftl`, import.meta.url),
      "utf8",
    );
    for (const name of ["saved", "unset", "loading", "unavailable", "error"]) {
      assert.match(ftl, new RegExp(`^pref-key-${name} = .+`, "m"));
    }
  });
}
