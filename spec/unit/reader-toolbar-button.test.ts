import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderButtonState } from "../../src/modules/copy/readerToolbarButton";

test("buildReaderButtonState appends the shortcut to the tooltip", () => {
  const state = buildReaderButtonState({
    canCopy: true,
    shortcutLabel: "Ctrl+Shift+C",
    label: "Copy Current Reader Attachment",
  });

  assert.equal(state.disabled, false);
  assert.match(state.tooltipText, /Ctrl\+Shift\+C/);
});

test("buildReaderButtonState uses the unavailable message when disabled", () => {
  const state = buildReaderButtonState({
    canCopy: false,
    shortcutLabel: "",
    label: "Copy Current Reader Attachment",
    unavailableMessage: "No eligible reader attachment.",
  });

  assert.equal(state.disabled, true);
  assert.equal(state.tooltipText, "No eligible reader attachment.");
});

test("buildReaderButtonState preserves localized Chinese labels", () => {
  const state = buildReaderButtonState({
    canCopy: false,
    shortcutLabel: "",
    label: "复制当前阅读器附件",
    unavailableMessage: "当前附件不可复制。",
  });

  assert.equal(state.disabled, true);
  assert.equal(state.label, "复制当前阅读器附件");
  assert.equal(state.tooltipText, "当前附件不可复制。");
});
