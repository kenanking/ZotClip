const MAX_CONCURRENCY = 3;
const AI_TAG_REQUEST_GAP_MS = 1000;

interface QueuedTask<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

const queue: QueuedTask<unknown>[] = [];
let activeWorkers = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function worker(): Promise<void> {
  while (true) {
    const task = queue.shift();
    if (!task) {
      break;
    }

    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    }

    await delay(AI_TAG_REQUEST_GAP_MS);
  }
}

function spawnWorkerIfNeeded(): void {
  if (activeWorkers >= MAX_CONCURRENCY) {
    return;
  }
  if (queue.length === 0) {
    return;
  }

  activeWorkers++;
  void worker().finally(() => {
    activeWorkers--;
    spawnWorkerIfNeeded();
  });
}

/**
 * Enqueue `fn` into a worker pool with at most {@link MAX_CONCURRENCY} tasks
 * in flight. After each task finishes (success or failure), the worker waits
 * {@link AI_TAG_REQUEST_GAP_MS} before picking up the next task.
 */
export function runWithAiTagGap<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject } as QueuedTask<unknown>);
    spawnWorkerIfNeeded();
  });
}
