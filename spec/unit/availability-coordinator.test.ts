import assert from "node:assert/strict";
import test from "node:test";

import { createAvailabilityCoordinator } from "../../src/modules/copy/runtime/availabilityCoordinator";

function createDeferred(): {
  promise: Promise<void>;
  resolve(): void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

test("availability coordinator collapses repeated in-flight selection refreshes", async () => {
  const coordinator = createAvailabilityCoordinator();
  const deferred = createDeferred();
  let refreshCalls = 0;

  const refresh = async () => {
    refreshCalls += 1;
    await deferred.promise;
  };

  const first = coordinator.requestSelectionRefresh("items:1", refresh);
  const second = coordinator.requestSelectionRefresh("items:1", refresh);

  assert.equal(refreshCalls, 1);
  deferred.resolve();
  await Promise.all([first, second]);
  assert.equal(refreshCalls, 1);
});

test("availability coordinator schedules one follow-up refresh after copy completion", async () => {
  const coordinator = createAvailabilityCoordinator();
  const deferred = createDeferred();
  let refreshCalls = 0;

  const refresh = async () => {
    refreshCalls += 1;
    if (refreshCalls === 1) {
      await deferred.promise;
    }
  };

  const first = coordinator.requestSelectionRefresh("items:1", refresh);
  coordinator.notifySelectionCopyCompleted();
  const second = coordinator.requestSelectionRefresh("items:1", refresh);

  assert.equal(refreshCalls, 1);
  deferred.resolve();
  await Promise.all([first, second]);
  assert.equal(refreshCalls, 2);
});

test("availability coordinator dedupes by key separately for selection and reader refreshes", async () => {
  const coordinator = createAvailabilityCoordinator();
  let selectionCalls = 0;
  let readerCalls = 0;

  await coordinator.requestSelectionRefresh("items:1", async () => {
    selectionCalls += 1;
  });
  await coordinator.requestSelectionRefresh("items:1", async () => {
    selectionCalls += 1;
  });
  await coordinator.requestSelectionRefresh("items:2", async () => {
    selectionCalls += 1;
  });

  await coordinator.requestReaderRefresh("reader:10", async () => {
    readerCalls += 1;
  });
  await coordinator.requestReaderRefresh("reader:10", async () => {
    readerCalls += 1;
  });
  await coordinator.requestReaderRefresh("reader:11", async () => {
    readerCalls += 1;
  });

  assert.equal(selectionCalls, 2);
  assert.equal(readerCalls, 2);
});

test("availability coordinator forces a refresh for the same selection after copy completion", async () => {
  const coordinator = createAvailabilityCoordinator();
  let refreshCalls = 0;

  await coordinator.requestSelectionRefresh("items:1", async () => {
    refreshCalls += 1;
  });

  coordinator.notifySelectionCopyCompleted();

  await coordinator.requestSelectionRefresh("items:1", async () => {
    refreshCalls += 1;
  });

  assert.equal(refreshCalls, 2);
});
