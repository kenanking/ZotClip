import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import {
  getAiApiKeyForProvider,
  setAiApiKeyForProvider,
} from "../../src/modules/tagging/credentials/zoteroCredentials";

interface Login {
  origin: string;
  httpRealm: string;
  password: string;
}

function fixture(asyncMutations: boolean) {
  const entries: Login[] = [];
  const logins = {
    initializationPromise: Promise.resolve(),
    findLogins() {
      throw new Error("findLogins was removed in Zotero 11");
    },
    async searchLoginsAsync(match: { origin: string; httpRealm: string }) {
      return entries.filter(
        (login) =>
          login.origin === match.origin && login.httpRealm === match.httpRealm,
      );
    },
    async addLoginAsync(login: Login) {
      await setTimeout(0);
      entries.push(login);
    },
  };
  const modify = (previous: Login, next: Login) => {
    entries.splice(entries.indexOf(previous), 1, next);
  };
  const remove = (login: Login) => {
    entries.splice(entries.indexOf(login), 1);
  };
  Object.assign(
    logins,
    asyncMutations
      ? {
          async modifyLoginAsync(previous: Login, next: Login) {
            await setTimeout(0);
            modify(previous, next);
          },
          async removeLoginAsync(login: Login) {
            await setTimeout(0);
            remove(login);
          },
        }
      : { modifyLogin: modify, removeLogin: remove },
  );
  (globalThis as any).Services = { logins };
  (globalThis as any).Components = {
    classes: {
      "@mozilla.org/login-manager/loginInfo;1": {
        createInstance() {
          return {
            init(
              origin: string,
              _formActionOrigin: string,
              httpRealm: string,
              _username: string,
              password: string,
            ) {
              Object.assign(this, { origin, httpRealm, password });
            },
          };
        },
      },
    },
    interfaces: { nsILoginInfo: {} },
  };
  return entries;
}

for (const asyncMutations of [true, false]) {
  test(`credentials work with ${asyncMutations ? "Zotero 11 async" : "Zotero 8–10 sync"} mutations`, async () => {
    const entries = fixture(asyncMutations);
    const endpoint = "https://credentials.test/v1/chat/completions";
    assert.equal(await getAiApiKeyForProvider("custom", endpoint), "");
    await setAiApiKeyForProvider("custom", "first", endpoint);
    assert.equal(await getAiApiKeyForProvider("custom", endpoint), "first");
    assert.equal(
      await getAiApiKeyForProvider("custom", "https://other.test/v1"),
      "",
    );
    assert.equal(await getAiApiKeyForProvider("deepseek", endpoint), "");
    entries.push({ ...entries[0], origin: "chrome://another-plugin" });

    await setAiApiKeyForProvider("custom", "second", endpoint);
    assert.equal(await getAiApiKeyForProvider("custom", endpoint), "second");
    assert.equal(entries.length, 2, "Replacement does not duplicate the login");

    await setAiApiKeyForProvider("custom", "", endpoint);
    assert.equal(await getAiApiKeyForProvider("custom", endpoint), "");
    assert.equal(entries.length, 1, "Other plugins' credentials are untouched");
  });
}
