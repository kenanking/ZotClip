import { test } from "node:test";
import assert from "node:assert/strict";

// Mock Zotero global for error logging
(globalThis as any).Zotero = { logError: () => {} };

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
    getTimeout: () => 120_000,
    getPrompt: (title) => `Tag: ${title}`,
    getRequestOptions: () => ({ includeJsonObjectResponseFormat: true }),
    httpRequest: async () => ({ response: "" }),
    onProgress: () => {},
    ...overrides,
  };
}

test("autoTagService does not disclose response content in failure messages", async () => {
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
  assert.equal((result as any).message, "Invalid AI response format");
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
  assert.equal((result as any).message, "Invalid AI response format");
});

test("cancelled network response cannot write tags", async () => {
  const controller = new AbortController();
  let saved = false;
  const item = {
    getField: () => "Title",
    getTags: () => [],
    addTag: () => {
      saved = true;
    },
    saveTx: async () => {
      saved = true;
    },
  } as any;
  const result = await autoTagItem(
    item,
    baseDeps({
      signal: controller.signal,
      httpRequest: async () => {
        controller.abort();
        return {
          response: JSON.stringify({
            choices: [{ message: { content: '{"tags":["tag"]}' } }],
          }),
        };
      },
    }),
  );
  assert.equal(result.kind, "cancelled");
  assert.equal(saved, false);
});

test("item becoming read-only during request is not modified", async () => {
  let editable = true,
    saved = false;
  const item = {
    getField: () => "Title",
    getTags: () => [],
    addTag: () => {
      saved = true;
    },
    saveTx: async () => {
      saved = true;
    },
  } as any;
  const result = await autoTagItem(
    item,
    baseDeps({
      canWrite: async () => editable,
      httpRequest: async () => {
        editable = false;
        return {
          response: JSON.stringify({
            choices: [{ message: { content: '{"tags":["tag"]}' } }],
          }),
        };
      },
    }),
  );
  assert.deepEqual(result, { kind: "skipped", reason: "notEditable" });
  assert.equal(saved, false);
});
