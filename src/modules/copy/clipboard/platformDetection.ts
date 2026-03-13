export interface PlatformContext {
  platform: "windows" | "linux" | "macos";
  linuxSession?: "x11" | "wayland" | "unknown";
}

export interface DetectPlatformContextInput {
  isWin?: boolean;
  isLinux?: boolean;
  isMac?: boolean;
  env?: Record<string, string | undefined>;
}

export function detectPlatformContext(
  input: DetectPlatformContextInput,
): PlatformContext {
  if (input.isWin) {
    return { platform: "windows" };
  }

  if (input.isMac) {
    return { platform: "macos" };
  }

  const env = input.env || {};
  if (env.WAYLAND_DISPLAY) {
    return { platform: "linux", linuxSession: "wayland" };
  }
  if (env.DISPLAY) {
    return { platform: "linux", linuxSession: "x11" };
  }

  return { platform: "linux", linuxSession: "unknown" };
}

export function detectCurrentPlatformContext(): PlatformContext {
  return detectPlatformContext({
    isWin: Zotero.isWin,
    isLinux: Zotero.isLinux,
    isMac: Zotero.isMac,
    env: {
      WAYLAND_DISPLAY: Services.env.get("WAYLAND_DISPLAY"),
      DISPLAY: Services.env.get("DISPLAY"),
    },
  });
}
