import type { CopyMessageKey } from "../types";
import type { PlatformContext } from "./platformDetection";
import { BACKEND_IDS, type BackendId } from "./types";

export interface ClipboardBackendStatus {
  activeBackend: BackendId;
  lastFallbackMessageKey?: CopyMessageKey;
}

export function resolveClipboardBackendStatus(
  platformContext: PlatformContext,
  commands: Record<string, boolean>,
): ClipboardBackendStatus {
  const activeBackend = getActiveBackendID(platformContext, commands);
  const lastFallbackMessageKey = getFallbackMessageKey(
    platformContext,
    commands,
    activeBackend,
  );

  return lastFallbackMessageKey
    ? {
        activeBackend,
        lastFallbackMessageKey,
      }
    : {
        activeBackend,
      };
}

function getActiveBackendID(
  platformContext: PlatformContext,
  commands: Record<string, boolean>,
): BackendId {
  if (platformContext.platform === "windows") {
    return BACKEND_IDS.WINDOWS_NATIVE;
  }

  if (platformContext.platform === "macos") {
    return commands.osascript
      ? BACKEND_IDS.MACOS_OSASCRIPT
      : BACKEND_IDS.PATH_TEXT;
  }

  if (platformContext.linuxSession === "wayland") {
    if (commands["wl-copy"]) return BACKEND_IDS.LINUX_WAYLAND;
    if (commands["gtk4-helper"]) return BACKEND_IDS.LINUX_GTK4;
    return BACKEND_IDS.FALLBACK;
  }

  if (commands["gtk4-helper"]) return BACKEND_IDS.LINUX_GTK4;
  if (commands["wl-copy"]) return BACKEND_IDS.LINUX_WAYLAND;
  return BACKEND_IDS.FALLBACK;
}

function getFallbackMessageKey(
  platformContext: PlatformContext,
  commands: Record<string, boolean>,
  activeBackend: BackendId,
): CopyMessageKey | undefined {
  if (platformContext.platform === "linux") {
    if (activeBackend !== BACKEND_IDS.FALLBACK) {
      return undefined;
    }

    if (!commands["gtk4-helper"] && !commands["wl-copy"]) {
      return "copy-linux-no-file-backend";
    }

    if (platformContext.linuxSession === "wayland" && !commands["wl-copy"]) {
      return "copy-linux-wl-copy-missing";
    }

    if (!commands["gtk4-helper"]) {
      return "copy-linux-gtk4-missing";
    }
  }

  if (platformContext.platform === "macos" && !commands.osascript) {
    return "copy-macos-osascript-missing";
  }

  return undefined;
}
