import type { PlatformContext } from "./platformDetection";
import { BACKEND_IDS } from "./types";

const GTK_HELPER_REASON =
  "Install python3-gi and gir1.2-gtk-4.0 to enable Linux file copy.";
const WAYLAND_REASON = "Install wl-clipboard to enable file copy on Wayland.";
const MACOS_REASON = "macOS osascript is required to copy files.";

export interface ClipboardBackendStatus {
  activeBackend: string;
  lastFallbackReason?: string;
}

export function resolveClipboardBackendStatus(
  platformContext: PlatformContext,
  commands: Record<string, boolean>,
): ClipboardBackendStatus {
  const activeBackend = getActiveBackendID(platformContext, commands);
  const lastFallbackReason = getFallbackReason(
    platformContext,
    commands,
    activeBackend,
  );

  return lastFallbackReason
    ? {
        activeBackend,
        lastFallbackReason,
      }
    : {
        activeBackend,
      };
}

function getActiveBackendID(
  platformContext: PlatformContext,
  commands: Record<string, boolean>,
): string {
  if (platformContext.platform === "windows") {
    return BACKEND_IDS.WINDOWS_NATIVE;
  }

  if (platformContext.platform === "macos") {
    return commands.osascript
      ? BACKEND_IDS.MACOS_OSASCRIPT
      : BACKEND_IDS.PATH_TEXT;
  }

  if (platformContext.linuxSession === "wayland") {
    return commands["wl-copy"]
      ? BACKEND_IDS.LINUX_WAYLAND
      : BACKEND_IDS.FALLBACK;
  }

  if (commands["gtk4-helper"]) {
    return BACKEND_IDS.LINUX_GTK4;
  }

  if (commands["wl-copy"]) {
    return BACKEND_IDS.LINUX_WAYLAND;
  }

  return BACKEND_IDS.FALLBACK;
}

function getFallbackReason(
  platformContext: PlatformContext,
  commands: Record<string, boolean>,
  activeBackend: string,
): string | undefined {
  if (platformContext.platform === "linux") {
    if (activeBackend !== BACKEND_IDS.FALLBACK) {
      return undefined;
    }

    if (platformContext.linuxSession === "wayland" && !commands["wl-copy"]) {
      return WAYLAND_REASON;
    }

    if (!commands["gtk4-helper"]) {
      return GTK_HELPER_REASON;
    }
  }

  if (platformContext.platform === "macos" && !commands.osascript) {
    return MACOS_REASON;
  }

  return undefined;
}
