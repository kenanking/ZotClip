import assert from "node:assert/strict";
import test from "node:test";

import { runWithAiTagGap } from "../../src/modules/tagging/core/autoTagQueue";

const GAP_MS = 1000;
const TOLERANCE_MS = 150;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("runWithAiTagGap executes a single task and returns its result", async () => {
  const result = await runWithAiTagGap(async () => "hello");
  assert.equal(result, "hello");
});

test("runWithAiTagGap propagates errors", async () => {
  await assert.rejects(
    runWithAiTagGap(async () => {
      throw new Error("boom");
    }),
    /boom/,
  );
});

test("runWithAiTagGap runs up to 3 tasks concurrently", async () => {
  let running = 0;
  let maxRunning = 0;

  const tasks = Array.from({ length: 6 }, () =>
    runWithAiTagGap(async () => {
      running++;
      if (running > maxRunning) {
        maxRunning = running;
      }
      await wait(50);
      running--;
    }),
  );

  await Promise.all(tasks);
  assert.ok(
    maxRunning <= 3,
    `expected max concurrency <= 3, got ${maxRunning}`,
  );
  assert.ok(
    maxRunning >= 2,
    `expected at least some concurrency, got ${maxRunning}`,
  );
});

test("runWithAiTagGap enqueues tasks after workers drain and still processes them", async () => {
  const results: number[] = [];

  const first = await runWithAiTagGap(async () => {
    results.push(1);
    return 1;
  });
  assert.equal(first, 1);

  await wait(GAP_MS + TOLERANCE_MS);

  const second = await runWithAiTagGap(async () => {
    results.push(2);
    return 2;
  });
  assert.equal(second, 2);

  assert.deepEqual(results, [1, 2]);
});

test("runWithAiTagGap does not block later tasks when an earlier task throws", async () => {
  const results: number[] = [];

  const [r1, r2] = await Promise.allSettled([
    runWithAiTagGap(async () => {
      throw new Error("fail");
    }),
    runWithAiTagGap(async () => {
      results.push(2);
      return 2;
    }),
  ]);

  assert.equal(r1.status, "rejected");
  assert.equal(r2.status, "fulfilled");
  if (r2.status === "fulfilled") {
    assert.equal(r2.value, 2);
  }
  assert.deepEqual(results, [2]);
});
