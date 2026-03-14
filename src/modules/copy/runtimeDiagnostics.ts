import {
  buildClipboardDiagnostics,
  type ClipboardDiagnostics,
} from "./clipboard/diagnostics";
import { resolveClipboardBackendStatus } from "./clipboard/backendStatus";
import { createCommandRunner } from "./clipboard/commandRunner";
import { buildLinuxGtkProbeCall } from "./clipboard/linuxGtkBackend";
import {
  detectCurrentPlatformContext,
  type PlatformContext,
} from "./clipboard/platformDetection";

const clipboardCommandRunner = createCommandRunner();

export async function getClipboardDiagnostics(): Promise<ClipboardDiagnostics> {
  const platformContext = detectCurrentPlatformContext();
  const commands = await probeClipboardSupport(platformContext);
  const backendStatus = resolveClipboardBackendStatus(platformContext, commands);

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
