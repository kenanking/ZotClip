import assert from "node:assert/strict";
import test from "node:test";

import { autoTagItem } from "../../src/modules/tagging/core/autoTagService";
import type { AutoTagServiceDeps } from "../../src/modules/tagging/core/types";
import { parseOllamaTagsResponse } from "../../src/modules/tagging/core/ollamaModels";
import { fillAiPromptTemplate } from "../../src/modules/tagging/core/promptTemplate";
import {
  resolveProviderEndpoint,
  resolveProviderRuntimePolicy,
} from "../../src/modules/tagging/core/providerAdapter";
import {
  parseAutoTagResponse,
  sanitizeAiJsonResponse,
} from "../../src/modules/tagging/core/responseParser";
import { isItemEligibleForAutoTagOnAdd } from "../../src/modules/tagging/integration/itemAddAutoTagEligibility";
import {
  buildProbeRequestBody,
  interpretProbeResponse,
  runAiConnectionProbe,
} from "../../src/modules/tagging/preferences/aiConnectionProbe";
import {
  resolveModelForAiProvider,
  type AiProviderConfig,
} from "../../src/utils/prefs";

const staticCfg: AiProviderConfig = {
  id: "test",
  label: "Test",
  endpoint: "https://example.com",
  models: [
    { value: "a", label: "A" },
    { value: "b", label: "B" },
  ],
  modelSource: "static",
  apiKeyRequired: true,
  endpointEditable: false,
};

const dynamicCfg: AiProviderConfig = {
  id: "ollama",
  label: "Ollama",
  endpoint: "http://localhost:11434",
  models: [],
  modelSource: "ollama-dynamic",
  apiKeyRequired: false,
  endpointEditable: true,
};

function createFakeItem(fields: Record<string, string>, tags: string[] = []) {
  const store = { ...fields };
  const tagList = tags.map((tag) => ({ tag }));
  return {
    getField(name: string) {
      return store[name] ?? "";
    },
    getTags() {
      return tagList;
    },
    addTagCalls: [] as string[],
    addTag(tag: string, _type: number) {
      this.addTagCalls.push(tag);
    },
    saveTxCalls: 0,
    async saveTx() {
      this.saveTxCalls += 1;
    },
  };
}

test("AI connection probe builds payloads and runs checks", () => {
  const withFmt = JSON.parse(
    buildProbeRequestBody("m", { includeJsonObjectResponseFormat: true }),
  ) as { max_tokens?: number; response_format?: { type: string } };
  assert.equal(withFmt.max_tokens, 1);
  assert.equal(withFmt.response_format?.type, "json_object");

  const noFmt = JSON.parse(
    buildProbeRequestBody("m", { includeJsonObjectResponseFormat: false }),
  ) as Record<string, unknown>;
  assert.equal(
    Object.prototype.hasOwnProperty.call(noFmt, "response_format"),
    false,
  );

  assert.deepEqual(
    interpretProbeResponse(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: "x" } }],
      }),
      200,
    ),
    { ok: true },
  );
  assert.equal(interpretProbeResponse('{"error":"nope"}', 401).ok, false);
});

test("runAiConnectionProbe validates inputs and completes a successful probe", async () => {
  const missing = await runAiConnectionProbe({
    url: " ",
    apiKey: "k",
    apiKeyRequired: true,
    model: "m",
    includeJsonObjectResponseFormat: true,
    httpPost: async () => ({ response: "", status: 200 }),
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.message, "__needs_endpoint__");

  let called = false;
  const ok = await runAiConnectionProbe({
    url: "https://example.com/v1/chat/completions",
    apiKey: "secret",
    apiKeyRequired: true,
    model: "x",
    includeJsonObjectResponseFormat: true,
    httpPost: async (url, opts) => {
      called = true;
      assert.equal(url, "https://example.com/v1/chat/completions");
      assert.ok(opts.headers.Authorization?.includes("secret"));
      return {
        response: JSON.stringify({
          choices: [{ message: { role: "assistant", content: "ok" } }],
        }),
        status: 200,
      };
    },
  });
  assert.equal(called, true);
  assert.deepEqual(ok, { ok: true });
});

test("autoTagItem skips when prerequisites are missing", async () => {
  const noTitle = createFakeItem({ title: "   " });
  const deps: AutoTagServiceDeps = {
    getEndpoint: () => "https://x",
    getApiKey: () => "k",
    isApiKeyRequired: () => true,
    getModel: () => "m",
    getRequestOptions: () => ({ includeJsonObjectResponseFormat: true }),
    getPrompt: () => "p",
    onProgress: () => {},
    httpRequest: async () => {
      throw new Error("should not call");
    },
  };
  assert.deepEqual(await autoTagItem(noTitle as any, deps), {
    kind: "skipped",
    reason: "noTitle",
  });

  const noKey = createFakeItem({ title: "T" });
  assert.deepEqual(
    await autoTagItem(noKey as any, {
      ...deps,
      getApiKey: () => "",
      isApiKeyRequired: () => true,
    }),
    { kind: "skipped", reason: "noApiKey" },
  );
});

test("autoTagItem adds only new model tags and saves once", async () => {
  const item = createFakeItem({ title: "T", abstractNote: "" }, ["foo"]);
  const body = JSON.stringify({
    choices: [{ message: { content: '{"tags":["foo","baz"]}' } }],
  });
  const deps: AutoTagServiceDeps = {
    getEndpoint: () => "https://x",
    getApiKey: () => "k",
    isApiKeyRequired: () => true,
    getModel: () => "m",
    getRequestOptions: () => ({ includeJsonObjectResponseFormat: true }),
    getPrompt: () => "p",
    onProgress: () => {},
    httpRequest: async () => ({ response: body }),
  };
  const r = await autoTagItem(item as any, deps);
  assert.deepEqual(r, { kind: "ok", tagsAdded: ["baz"] });
  assert.equal(item.saveTxCalls, 1);
  assert.deepEqual(item.addTagCalls, ["baz"]);
});

test("isItemEligibleForAutoTagOnAdd allows regular items and blocks feeds", () => {
  assert.equal(
    isItemEligibleForAutoTagOnAdd({
      isRegularItem: () => true,
      isFeedItem: false,
    }),
    true,
  );
  assert.equal(
    isItemEligibleForAutoTagOnAdd({
      isRegularItem: () => true,
      isFeedItem: true,
    }),
    false,
  );
  assert.equal(
    isItemEligibleForAutoTagOnAdd({
      isRegularItem: () => false,
      isFeedItem: false,
    }),
    false,
  );
});

test("parseOllamaTagsResponse maps model names", () => {
  const raw = JSON.stringify({
    models: [{ name: "llama3.1:latest" }, { name: "qwen2:7b" }],
  });
  assert.deepEqual(parseOllamaTagsResponse(raw), [
    { value: "llama3.1:latest", label: "llama3.1:latest" },
    { value: "qwen2:7b", label: "qwen2:7b" },
  ]);
});

test("fillAiPromptTemplate substitutes placeholders", () => {
  assert.equal(
    fillAiPromptTemplate("{title} {title}|{abstract}|{language}", {
      title: "a{t}tle",
      abstract: "abs",
      language: "English",
    }),
    "a{t}tle a{t}tle|abs|English",
  );
});

test("provider adapter normalizes Ollama endpoint and relaxes JSON mode", () => {
  assert.equal(
    resolveProviderEndpoint("ollama", "http://localhost:11434///"),
    "http://localhost:11434/v1/chat/completions",
  );
  const ollama = resolveProviderRuntimePolicy({
    providerId: "ollama",
    endpointOverride: "http://localhost:11434/",
  });
  assert.equal(ollama.apiKeyRequired, false);
  assert.equal(ollama.includeJsonObjectResponseFormat, false);

  const deepseek = resolveProviderRuntimePolicy({ providerId: "deepseek" });
  assert.equal(deepseek.apiKeyRequired, true);
  assert.equal(deepseek.includeJsonObjectResponseFormat, true);

  const custom = resolveProviderRuntimePolicy({
    providerId: "custom",
    endpointOverride: "https://my-api.example.com/v1",
  });
  assert.equal(custom.includeJsonObjectResponseFormat, false);
});

test("provider adapter normalizes LM Studio endpoint and relaxes JSON mode", () => {
  assert.equal(
    resolveProviderEndpoint("lmstudio", "http://localhost:1234///"),
    "http://localhost:1234/v1/chat/completions",
  );
  const lmstudio = resolveProviderRuntimePolicy({
    providerId: "lmstudio",
    endpointOverride: "http://localhost:1234/",
  });
  assert.equal(lmstudio.apiKeyRequired, false);
  assert.equal(lmstudio.includeJsonObjectResponseFormat, false);
});

test("resolveProviderEndpoint normalizes custom provider endpoint", () => {
  assert.equal(
    resolveProviderEndpoint("custom", "https://api.example.com/v1"),
    "https://api.example.com/v1/chat/completions",
  );
  assert.equal(
    resolveProviderEndpoint(
      "custom",
      "https://api.example.com/v1/chat/completions",
    ),
    "https://api.example.com/v1/chat/completions",
  );
});

test("resolveModelForAiProvider picks listed static models and passes through dynamic ids", () => {
  assert.equal(resolveModelForAiProvider(staticCfg, "b"), "b");
  assert.equal(resolveModelForAiProvider(staticCfg, "unknown"), "a");
  assert.equal(
    resolveModelForAiProvider(dynamicCfg, "llama3.1:latest"),
    "llama3.1:latest",
  );
});

test("sanitizeAiJsonResponse and parseAutoTagResponse handle typical model output", () => {
  const raw = '```json\n{"tags":[" a ", "b"]}\n```';
  assert.equal(sanitizeAiJsonResponse(raw), '{"tags":[" a ", "b"]}');
  assert.deepEqual(parseAutoTagResponse('{"tags":[" a ", "b"]}'), {
    tags: ["a", "b"],
  });
  assert.deepEqual(parseAutoTagResponse("{}"), { tags: [] });
});

test("parseAutoTagResponse throws on non-array tags", () => {
  assert.throws(() => parseAutoTagResponse('{"tags": "machine learning"}'), {
    message: "Response is not a JSON object with a tags array",
  });
  assert.throws(() => parseAutoTagResponse('{"tags": 123}'), {
    message: "Response is not a JSON object with a tags array",
  });
  assert.deepEqual(parseAutoTagResponse('{"other": 1}'), { tags: [] });
});
