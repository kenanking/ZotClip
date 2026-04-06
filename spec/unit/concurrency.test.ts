import { test } from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrencyLimit } from "../../src/utils/concurrency";

test("mapWithConcurrencyLimit returns empty for empty input", async () => {
  const result = await mapWithConcurrencyLimit([], 4, async (x) => x);
  assert.deepStrictEqual(result, []);
});

test("mapWithConcurrencyLimit maps all items preserving order", async () => {
  const input = [1, 2, 3, 4, 5];
  const result = await mapWithConcurrencyLimit(input, 2, async (x) => x * 10);
  assert.deepStrictEqual(result, [10, 20, 30, 40, 50]);
});

test("mapWithConcurrencyLimit respects concurrency limit", async () => {
  let activeTasks = 0;
  let maxActive = 0;
  const concurrency = 2;

  const input = [10, 20, 30, 40, 50];
  await mapWithConcurrencyLimit(input, concurrency, async (x) => {
    activeTasks += 1;
    if (activeTasks > maxActive) {
      maxActive = activeTasks;
    }
    await new Promise((r) => setTimeout(r, 5));
    activeTasks -= 1;
    return x;
  });

  assert.ok(
    maxActive <= concurrency,
    `max active ${maxActive} exceeded concurrency ${concurrency}`,
  );
  assert.ok(maxActive > 0, "at least one task ran concurrently");
});

test("mapWithConcurrencyLimit passes index to map function", async () => {
  const input = ["a", "b", "c"];
  const indices: number[] = [];
  await mapWithConcurrencyLimit(input, 1, async (_value, index) => {
    indices.push(index);
  });
  assert.deepStrictEqual(indices, [0, 1, 2]);
});

test("mapWithConcurrencyLimit handles concurrency larger than input", async () => {
  const input = [1, 2];
  const result = await mapWithConcurrencyLimit(input, 100, async (x) => x + 1);
  assert.deepStrictEqual(result, [2, 3]);
});
