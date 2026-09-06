import { runWithAiTagGap } from "./autoTagQueue";
import type { AutoTagResult } from "./types";

const groups = new Set<AbortController>();
const busyItems = new Set<number>();

export function cancelAllAiTasks(): void {
  for (const controller of groups) controller.abort();
}

export function createAiTaskGroup() {
  const controller = new AbortController();
  groups.add(controller);
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
    dispose: () => {
      controller.abort();
      groups.delete(controller);
    },
    async run(
      itemID: number,
      work: (signal: AbortSignal) => Promise<AutoTagResult>,
    ): Promise<AutoTagResult> {
      if (controller.signal.aborted) return { kind: "cancelled" };
      if (busyItems.has(itemID)) return { kind: "skipped", reason: "busy" };
      busyItems.add(itemID);
      try {
        return await runWithAiTagGap(
          () => work(controller.signal),
          controller.signal,
        );
      } catch (error) {
        if (controller.signal.aborted) return { kind: "cancelled" };
        throw error;
      } finally {
        busyItems.delete(itemID);
      }
    },
  };
}
