import assert from "node:assert/strict";
import test from "node:test";

const store: Record<string, string> = {};
(globalThis as any).Zotero = {
  Prefs: {
    get(key: string) {
      return store[key] ?? "";
    },
    set(key: string, value: string) {
      store[key] = value;
    },
  },
};

import {
  getEffectiveAiModel,
  reconcileAiModelForProvider,
} from "../../src/utils/prefs";
import { resolveProviderEndpoint } from "../../src/modules/tagging/core/providerAdapter";

const P = "extensions.zotero.zotclip";

function clearStore() {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
}

test("resolveProviderEndpoint resolves Ollama, LM Studio, custom base, and static providers", () => {
  clearStore();
  store["extensions.zotero.zotclip.aiEndpointOllama"] =
    "http://localhost:11434///";
  assert.equal(
    resolveProviderEndpoint("ollama"),
    "http://localhost:11434/v1/chat/completions",
  );

  store["extensions.zotero.zotclip.aiEndpointLmstudio"] =
    "http://localhost:1234/";
  assert.equal(
    resolveProviderEndpoint("lmstudio"),
    "http://localhost:1234/v1/chat/completions",
  );

  assert.equal(
    resolveProviderEndpoint("lmstudio"),
    "http://localhost:1234/v1/chat/completions",
  );

  store["extensions.zotero.zotclip.aiApiEndpoint"] =
    "https://api.moonshot.cn/v1";
  assert.equal(
    resolveProviderEndpoint("custom"),
    "https://api.moonshot.cn/v1/chat/completions",
  );

  assert.equal(
    resolveProviderEndpoint("deepseek"),
    "https://api.deepseek.com/v1/chat/completions",
  );
});

test("AI model prefs reconcile on provider switch and resolve effective model", () => {
  clearStore();
  store[`${P}.aiModel`] = "kimi-k2.5";
  store[`${P}.aiLastModelOllama`] = "llama3.1:latest";
  reconcileAiModelForProvider("ollama");
  assert.equal(store[`${P}.aiModel`], "llama3.1:latest");

  store[`${P}.aiProvider`] = "ollama";
  store[`${P}.aiModel`] = "";
  store[`${P}.aiLastModelOllama`] = "mistral:latest";
  assert.equal(getEffectiveAiModel(), "mistral:latest");

  store[`${P}.aiModel`] = "not-a-deepseek-model";
  reconcileAiModelForProvider("deepseek");
  assert.equal(store[`${P}.aiModel`], "deepseek-v4-flash");
});

test("LM Studio model prefs reconcile and resolve effective model", () => {
  clearStore();
  store[`${P}.aiModel`] = "deepseek-chat";
  store[`${P}.aiLastModelLmstudio`] = "llama-3.1-8b-instruct";
  reconcileAiModelForProvider("lmstudio");
  assert.equal(store[`${P}.aiModel`], "llama-3.1-8b-instruct");

  store[`${P}.aiProvider`] = "lmstudio";
  store[`${P}.aiModel`] = "";
  store[`${P}.aiLastModelLmstudio`] = "mistral-7b-instruct";
  assert.equal(getEffectiveAiModel(), "mistral-7b-instruct");
});
