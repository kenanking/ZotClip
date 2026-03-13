import assert from "node:assert/strict";
import test from "node:test";

import {
  formatShortcut,
  matchesShortcut,
  parseShortcut,
} from "../../src/modules/copy/shortcuts";

test("parseShortcut normalizes modifier ordering", () => {
  assert.deepEqual(parseShortcut("shift+ctrl+c"), {
    alt: false,
    ctrlOrMeta: true,
    key: "c",
    shift: true,
  });
});

test("matchesShortcut accepts Ctrl on Windows and Meta on macOS", () => {
  const shortcut = parseShortcut("Ctrl+C");
  assert.ok(shortcut);

  assert.equal(
    matchesShortcut(shortcut, {
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      key: "c",
    } as KeyboardEvent),
    true,
  );
  assert.equal(
    matchesShortcut(shortcut, {
      ctrlKey: false,
      metaKey: true,
      altKey: false,
      shiftKey: false,
      key: "c",
    } as KeyboardEvent),
    true,
  );
});

test("formatShortcut outputs a stable label", () => {
  assert.equal(formatShortcut(parseShortcut("shift+ctrl+c")), "Ctrl+Shift+C");
  assert.equal(formatShortcut(undefined), "");
});
