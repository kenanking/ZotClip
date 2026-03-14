import { config } from "../../package.json";
import { normalizeExtensionList } from "../modules/copy/attachmentTypes";
import {
  buildClipboardDiagnostics,
  type ClipboardDiagnostics,
} from "../modules/copy/clipboard/diagnostics";
import { resolveClipboardBackendStatus } from "../modules/copy/clipboard/backendStatus";
import { createCommandRunner } from "../modules/copy/clipboard/commandRunner";
import { buildLinuxGtkProbeCall } from "../modules/copy/clipboard/linuxGtkBackend";
import {
  detectCurrentPlatformContext,
  type PlatformContext,
} from "../modules/copy/clipboard/platformDetection";
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

export function getMainToolbarButtonEnabled(): boolean {
  const value = getPref("showMainToolbarButton");
  return value !== false;
}

export function getReaderToolbarButtonEnabled(): boolean {
  const value = getPref("showReaderToolbarButton");
  return value !== false;
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
  const commands = await probeClipboardSupport(platformContext);
  const backendStatus = resolveClipboardBackendStatus(
    platformContext,
    commands,
  );

  return buildClipboardDiagnostics({
    platform: platformContext.platform,
    linuxSession: platformContext.linuxSession,
    commands,
    activeBackend: backendStatus.activeBackend,
    lastFallbackMessageKey: backendStatus.lastFallbackMessageKey,
  });
}

async function probeClipboardSupport(
  platformContext: PlatformContext,
): Promise<Record<string, boolean>> {
  if (platformContext.platform === "linux") {
    if (platformContext.linuxSession === "wayland") {
      return {
        "wl-copy": await clipboardCommandRunner.probeCommand("wl-copy"),
      };
    }

    if (platformContext.linuxSession === "x11") {
      return {
        "gtk4-helper": await probeLinuxGtkSupport(),
      };
    }

    // Probe both backends concurrently for unknown session
    const [gtk4Helper, wlCopy] = await Promise.all([
      probeLinuxGtkSupport(),
      clipboardCommandRunner.probeCommand("wl-copy"),
    ]);

    return {
      "gtk4-helper": gtk4Helper,
      "wl-copy": wlCopy,
    };
  }

  if (platformContext.platform === "macos") {
    return {
      osascript: await clipboardCommandRunner.probeCommand("osascript"),
    };
  }

  return {};
}

async function probeLinuxGtkSupport(): Promise<boolean> {
  const result = await clipboardCommandRunner.runCommand(
    buildLinuxGtkProbeCall(),
  );
  return result.ok;
}
