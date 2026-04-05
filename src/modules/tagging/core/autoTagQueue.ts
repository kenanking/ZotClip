/** Space out AI calls to reduce provider rate limits (manual + auto on-add). */
const AI_TAG_REQUEST_GAP_MS = 1000;

let tail: Promise<unknown> = Promise.resolve();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Run `fn` after prior tagging work finishes. After `fn` settles (success or
 * failure), waits {@link AI_TAG_REQUEST_GAP_MS} before the next task starts.
 */
export function runWithAiTagGap<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(() => fn());
  tail = run.then(
    () => delay(AI_TAG_REQUEST_GAP_MS),
    () => delay(AI_TAG_REQUEST_GAP_MS),
  );
  return run;
}
