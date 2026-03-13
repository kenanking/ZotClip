import { config } from "../../package.json";
import { normalizeExtensionList } from "../modules/copy/attachmentTypes";
import {
  buildClipboardDiagnostics,
  type ClipboardDiagnostics,
} from "../modules/copy/clipboard/diagnostics";
import { createCommandRunner } from "../modules/copy/clipboard/commandRunner";
import {
  detectCurrentPlatformContext,
  type PlatformContext,
} from "../modules/copy/clipboard/platformDetection";
import { getCurrentLanguageTag } from "../modules/copy/uiStrings";
import type { MultiAttachmentMode } from "../modules/copy/types";

type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];

const PREFS_PREFIX = config.prefsPrefix;
const clipboardCommandRunner = createCommandRunner();

/**
 * Get preference value.
 * Wrapper of `Zotero.Prefs.get`.
 * @param key
 */
export function getPref<K extends keyof PluginPrefsMap>(key: K) {
  return Zotero.Prefs.get(`${PREFS_PREFIX}.${key}`, true) as PluginPrefsMap[K];
}

/**
 * Set preference value.
 * Wrapper of `Zotero.Prefs.set`.
 * @param key
 * @param value
 */
export function setPref<K extends keyof PluginPrefsMap>(
  key: K,
  value: PluginPrefsMap[K],
) {
  return Zotero.Prefs.set(`${PREFS_PREFIX}.${key}`, value, true);
}

/**
 * Clear preference value.
 * Wrapper of `Zotero.Prefs.clear`.
 * @param key
 */
export function clearPref(key: string) {
  return Zotero.Prefs.clear(`${PREFS_PREFIX}.${key}`, true);
}

export function getMultiAttachmentMode(): MultiAttachmentMode {
  const value = getPref("multiAttachmentMode");
  return value === "primary" ? "primary" : "all";
}

export function getLibraryShortcut(): string {
  return (getPref("libraryShortcut") || "Ctrl+C").trim();
}

export function getReaderShortcut(): string {
  return (getPref("readerShortcut") || "").trim();
}

export function getEnabledAttachmentTypes(): string[] {
  return normalizeExtensionList(getPref("enabledAttachmentTypes") || "");
}

export function getCustomAttachmentTypes(): string[] {
  return normalizeExtensionList(getPref("customAttachmentTypes") || "");
}

export function getAllowedAttachmentTypes(): string[] {
  return normalizeExtensionList([
    ...getEnabledAttachmentTypes(),
    ...getCustomAttachmentTypes(),
  ]);
}

export async function getClipboardDiagnostics(): Promise<ClipboardDiagnostics> {
  const platformContext = detectCurrentPlatformContext();
  const commandNames = getClipboardCommandNames(platformContext);
  const commands = await probeClipboardCommands(commandNames);

  return buildClipboardDiagnostics({
    platform: platformContext.platform,
    linuxSession: platformContext.linuxSession,
    commands,
    activeBackend: getActiveBackendID(platformContext, commands),
    languageTag: getCurrentLanguageTag(),
    lastFallbackReason: getFallbackReason(platformContext, commands),
  });
}

function getClipboardCommandNames(platformContext: PlatformContext): string[] {
  if (platformContext.platform === "linux") {
    if (platformContext.linuxSession === "wayland") {
      return ["wl-copy"];
    }

    if (platformContext.linuxSession === "x11") {
      return ["xclip"];
    }

    return ["wl-copy", "xclip"];
  }

  if (platformContext.platform === "macos") {
    return ["osascript"];
  }

  return [];
}

async function probeClipboardCommands(
  commandNames: string[],
): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    commandNames.map(
      async (commandName) =>
        [
          commandName,
          await clipboardCommandRunner.probeCommand(commandName),
        ] as const,
    ),
  );

  return Object.fromEntries(entries);
}

function getActiveBackendID(
  platformContext: PlatformContext,
  commands: Record<string, boolean>,
): string {
  if (platformContext.platform === "windows") {
    return "windows-native";
  }

  if (platformContext.platform === "macos") {
    return commands.osascript ? "macos-osascript-file-list" : "path-text";
  }

  if (platformContext.linuxSession === "wayland") {
    return commands["wl-copy"]
      ? "linux-wayland-wl-copy-uri-list"
      : "generic-clipboard-fallback";
  }

  if (platformContext.linuxSession === "x11") {
    return commands.xclip
      ? "linux-x11-xclip-uri-list"
      : "generic-clipboard-fallback";
  }

  if (commands["wl-copy"]) {
    return "linux-wayland-wl-copy-uri-list";
  }

  if (commands.xclip) {
    return "linux-x11-xclip-uri-list";
  }

  return "generic-clipboard-fallback";
}

function getFallbackReason(
  platformContext: PlatformContext,
  commands: Record<string, boolean>,
): string | undefined {
  if (platformContext.platform === "linux") {
    if (platformContext.linuxSession === "wayland" && !commands["wl-copy"]) {
      return "Install wl-clipboard to enable file copy on Wayland.";
    }

    if (platformContext.linuxSession === "x11" && !commands.xclip) {
      return "Install xclip to enable file copy on X11.";
    }
  }

  if (platformContext.platform === "macos" && !commands.osascript) {
    return "macOS osascript is required to copy files.";
  }

  return undefined;
}
