import assert from "node:assert/strict";
import test from "node:test";

import type { PlatformContext } from "../../src/modules/copy/clipboard/platformDetection";
import { BACKEND_IDS } from "../../src/modules/copy/clipboard/types";

type ResolveClipboardBackendStatus = (
  platformContext: PlatformContext,
  commands: Record<string, boolean>,
) => {
  activeBackend: string;
  lastFallbackMessageKey?: string;
};

async function loadResolver(): Promise<
  ResolveClipboardBackendStatus | undefined
> {
  try {
    const module =
      (await import("../../src/modules/copy/clipboard/backendStatus")) as {
        resolveClipboardBackendStatus?: ResolveClipboardBackendStatus;
      };
    return module.resolveClipboardBackendStatus;
  } catch {
    return undefined;
  }
}

test("unknown Linux session uses wl-copy without reporting a GTK fallback reason", async () => {
  const resolveClipboardBackendStatus = await loadResolver();

  assert.equal(typeof resolveClipboardBackendStatus, "function");

  const result = resolveClipboardBackendStatus!(
    {
      platform: "linux",
      linuxSession: "unknown",
    },
    {
      "gtk4-helper": false,
      "wl-copy": true,
    },
  );

  assert.deepEqual(result, {
    activeBackend: BACKEND_IDS.LINUX_WAYLAND,
  });
});

test("unknown Linux session uses the GTK helper without reporting a wl-copy fallback reason", async () => {
  const resolveClipboardBackendStatus = await loadResolver();

  assert.equal(typeof resolveClipboardBackendStatus, "function");

  const result = resolveClipboardBackendStatus!(
    {
      platform: "linux",
      linuxSession: "unknown",
    },
    {
      "gtk4-helper": true,
      "wl-copy": false,
    },
  );

  assert.deepEqual(result, {
    activeBackend: BACKEND_IDS.LINUX_GTK4,
  });
});

test("unknown Linux session keeps a Linux fallback reason only when no file backend is available", async () => {
  const resolveClipboardBackendStatus = await loadResolver();

  assert.equal(typeof resolveClipboardBackendStatus, "function");

  const result = resolveClipboardBackendStatus!(
    {
      platform: "linux",
      linuxSession: "unknown",
    },
    {
      "gtk4-helper": false,
      "wl-copy": false,
    },
  );

  assert.deepEqual(result, {
    activeBackend: BACKEND_IDS.FALLBACK,
    lastFallbackMessageKey: "copy-linux-gtk4-missing",
  });
});

test("macOS reports the native backend when osascript is available", async () => {
  const resolveClipboardBackendStatus = await loadResolver();

  assert.equal(typeof resolveClipboardBackendStatus, "function");

  const result = resolveClipboardBackendStatus!(
    {
      platform: "macos",
    },
    {
      osascript: true,
    },
  );

  assert.deepEqual(result, {
    activeBackend: BACKEND_IDS.MACOS_OSASCRIPT,
  });
});

test("macOS reports the path-text fallback reason only when osascript is unavailable", async () => {
  const resolveClipboardBackendStatus = await loadResolver();

  assert.equal(typeof resolveClipboardBackendStatus, "function");

  const result = resolveClipboardBackendStatus!(
    {
      platform: "macos",
    },
    {
      osascript: false,
    },
  );

  assert.deepEqual(result, {
    activeBackend: BACKEND_IDS.PATH_TEXT,
    lastFallbackMessageKey: "copy-macos-osascript-missing",
  });
});
