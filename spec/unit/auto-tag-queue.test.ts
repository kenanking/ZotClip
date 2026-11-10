import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { setImmediate } from "node:timers/promises";

import { runWithAiTagGap } from "../../src/modules/tagging/core/autoTagQueue";

const GAP_MS = 1000;

beforeEach((t) => t.mock.timers.enable({ apis: ["setTimeout"] }));
afterEach(async (t) => {
  t.mock.timers.tick(GAP_MS);
  await setImmediate();
});

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

test("runWithAiTagGap runs 3 tasks concurrently and waits a full second between batches", async (t) => {
  let running = 0;
  let maxRunning = 0;
  let started = 0;
  const release: (() => void)[] = [];

  const tasks = Array.from({ length: 6 }, () =>
    runWithAiTagGap(async () => {
      started++;
      running++;
      if (running > maxRunning) {
        maxRunning = running;
      }
      await new Promise<void>((resolve) => release.push(resolve));
      running--;
    }),
  );

  assert.equal(started, 3);
  release.splice(0).forEach((resolve) => resolve());
  await setImmediate();
  t.mock.timers.tick(GAP_MS - 1);
  await setImmediate();
  assert.equal(started, 3, "Workers must observe the request gap");
  t.mock.timers.tick(1);
  await setImmediate();
  assert.equal(started, 6);
  release.splice(0).forEach((resolve) => resolve());
  await Promise.all(tasks);
  assert.equal(maxRunning, 3);
});

test("runWithAiTagGap enqueues tasks after workers drain and still processes them", async (t) => {
  const results: number[] = [];

  const first = await runWithAiTagGap(async () => {
    results.push(1);
    return 1;
  });
  assert.equal(first, 1);

  t.mock.timers.tick(GAP_MS);
  await setImmediate();

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
