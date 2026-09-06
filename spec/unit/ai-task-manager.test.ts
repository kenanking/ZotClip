import assert from "node:assert/strict";
import test from "node:test";
import {
  createAiTaskGroup,
  cancelAllAiTasks,
} from "../../src/modules/tagging/core/taskManager";

test("duplicate tasks are skipped and cancellation prevents subsequent work", async () => {
  const group = createAiTaskGroup();
  let finish!: () => void;
  const pending = group.run(12, async (signal) => {
    await new Promise<void>((r) => {
      finish = r;
    });
    return signal.aborted
      ? { kind: "cancelled" }
      : { kind: "ok", tagsAdded: [] };
  });
  assert.deepEqual(
    await group.run(12, async () => {
      throw new Error("duplicate executed");
    }),
    { kind: "skipped", reason: "busy" },
  );
  cancelAllAiTasks();
  finish();
  assert.equal((await pending).kind, "cancelled");
  assert.equal(
    (
      await group.run(13, async () => {
        throw new Error("cancelled executed");
      })
    ).kind,
    "cancelled",
  );
  group.dispose();
});
