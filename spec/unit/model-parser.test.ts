import { test } from "node:test";
import assert from "node:assert/strict";
import { parseModelListResponse } from "../../src/modules/tagging/core/modelParser";

test("parseModelListResponse parses valid model list", () => {
  const raw = JSON.stringify({
    models: [{ name: "llama3" }, { name: "codellama" }],
  });
  const result = parseModelListResponse(raw, "models", "name", "TestProvider");
  assert.deepStrictEqual(result, [
    { value: "llama3", label: "llama3" },
    { value: "codellama", label: "codellama" },
  ]);
});

test("parseModelListResponse throws on invalid JSON", () => {
  assert.throws(
    () => parseModelListResponse("not-json", "models", "name", "TestProvider"),
    /Failed to parse TestProvider response: invalid JSON/,
  );
});

test("parseModelListResponse throws on unexpected shape", () => {
  assert.throws(
    () =>
      parseModelListResponse(
        JSON.stringify({ other: [] }),
        "models",
        "name",
        "TestProvider",
      ),
    /Failed to parse TestProvider response: unexpected shape/,
  );
});

test("parseModelListResponse filters out entries with empty or missing name", () => {
  const raw = JSON.stringify({
    data: [{ id: "good" }, { id: "" }, { id: "  " }, { notId: "skip" }],
  });
  const result = parseModelListResponse(raw, "data", "id", "TestProvider");
  assert.deepStrictEqual(result, [{ value: "good", label: "good" }]);
});

test("parseModelListResponse returns empty for empty array", () => {
  const raw = JSON.stringify({ models: [] });
  const result = parseModelListResponse(raw, "models", "name", "TestProvider");
  assert.deepStrictEqual(result, []);
});
