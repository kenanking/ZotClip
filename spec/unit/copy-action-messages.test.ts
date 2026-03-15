import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActionTooltip,
  formatActionExecutionMessage,
} from "../../src/modules/copy/interaction/presentation/copyActionMessages";

test("buildActionTooltip prefers the disabled reason over the default label", () => {
  assert.equal(
    buildActionTooltip(
      "Copy File",
      {
        primary: {
          kind: "copy-files",
          canExecute: false,
          reasonKey: "copy-reader-no-active",
          run: async () => {
            throw new Error("The disabled action should not run.");
          },
        },
      },
      {
        renderMessage: (key) =>
          key === "copy-reader-no-active"
            ? "No active reader attachment"
            : String(key),
      },
    ),
    "No active reader attachment",
  );
});

test("formatActionExecutionMessage renders explicit path copy without fallback wording", () => {
  assert.equal(
    formatActionExecutionMessage(
      {
        ok: true,
        format: "path-text",
        count: 1,
        outcome: "copied-path-text-explicit",
        messageKey: "copy-path-text-explicit",
      },
      {
        renderMessage: (key, args) =>
          key === "copy-path-text-explicit"
            ? `Copied ${args?.count} attachment path(s) to clipboard.`
            : String(key),
      },
    ),
    "Copied 1 attachment path(s) to clipboard.",
  );
});
