import assert from "node:assert/strict";
import test from "node:test";

import { detectPlatformContext } from "../../src/modules/copy/clipboard/platformDetection";

test("detectPlatformContext returns wayland when WAYLAND_DISPLAY is set", () => {
  const result = detectPlatformContext({
    isLinux: true,
    env: { WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":1" },
  });

  assert.equal(result.platform, "linux");
  assert.equal(result.linuxSession, "wayland");
});

test("detectPlatformContext returns x11 when DISPLAY is set without WAYLAND_DISPLAY", () => {
  const result = detectPlatformContext({
    isLinux: true,
    env: { DISPLAY: ":0" },
  });

  assert.equal(result.platform, "linux");
  assert.equal(result.linuxSession, "x11");
});
