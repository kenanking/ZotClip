import { test } from "node:test";
import assert from "node:assert/strict";

import { autoTagItem } from "../../src/modules/tagging/core/autoTagService";
import type { AutoTagServiceDeps } from "../../src/modules/tagging/core/types";

function baseDeps(
  overrides: Partial<AutoTagServiceDeps> = {},
): AutoTagServiceDeps {
  return {
    getApiKey: () => "test-key",
    isApiKeyRequired: () => true,
    getEndpoint: () => "https://api.test/v1/chat/completions",
    getModel: () => "test-model",
    getPrompt: (title) => `Tag: ${title}`,
    getRequestOptions: () => ({ includeJsonObjectResponseFormat: true }),
    httpRequest: async () => ({ response: "" }),
    onProgress: () => {},
    ...overrides,
  };
}

test("autoTagService includes original error detail in failure message", async () => {
  const item = {
    getField: (f: string) => (f === "title" ? "Test Title" : ""),
    getTags: () => [],
    addTag: () => {},
    saveTx: async () => {},
  } as any;

  const result = await autoTagItem(
    item,
    baseDeps({
      httpRequest: async () => ({
        response: "this is not json at all",
      }),
    }),
  );

  assert.equal(result.kind, "failed");
  assert.ok(
    (result as any).message.includes("Invalid AI response format:"),
    `expected detailed message, got: ${(result as any).message}`,
  );
  assert.ok(
    (result as any).message.length > "Invalid AI response format:".length + 1,
    "message should include the original error detail",
  );
});

test("autoTagService returns failure when response has empty content", async () => {
  const item = {
    getField: (f: string) => (f === "title" ? "Test Title" : ""),
    getTags: () => [],
    addTag: () => {},
    saveTx: async () => {},
  } as any;

  const result = await autoTagItem(
    item,
    baseDeps({
      httpRequest: async () => ({
        response: JSON.stringify({ choices: [{ message: {} }] }),
      }),
    }),
  );

  assert.equal(result.kind, "failed");
  assert.ok(
    (result as any).message.includes("Empty response content"),
    `expected empty content detail, got: ${(result as any).message}`,
  );
});
