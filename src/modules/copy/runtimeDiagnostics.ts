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
import { getClipboardRuntimeCache } from "./clipboard/runtimeCache";

const clipboardCommandRunner = createCommandRunner();
const clipboardRuntimeCache = getClipboardRuntimeCache();

export async function getClipboardDiagnostics(): Promise<ClipboardDiagnostics> {
  const platformContext = clipboardRuntimeCache.getPlatformContext(() =>
    detectCurrentPlatformContext(),
  );
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
        "wl-copy": await clipboardRuntimeCache.getCommandAvailability(
          "wl-copy",
          async () => clipboardCommandRunner.probeCommand("wl-copy"),
        ),
      };
    }

    if (platformContext.linuxSession === "x11") {
      return {
        "gtk4-helper": await clipboardRuntimeCache.getLinuxGtkAvailability(
          async () => probeLinuxGtkSupport(),
        ),
      };
    }

    const [gtk4Helper, wlCopy] = await Promise.all([
      clipboardRuntimeCache.getLinuxGtkAvailability(async () =>
        probeLinuxGtkSupport(),
      ),
      clipboardRuntimeCache.getCommandAvailability("wl-copy", async () =>
        clipboardCommandRunner.probeCommand("wl-copy"),
      ),
    ]);

    return {
      "gtk4-helper": gtk4Helper,
      "wl-copy": wlCopy,
    };
  }

  if (platformContext.platform === "macos") {
    return {
      osascript: await clipboardRuntimeCache.getCommandAvailability(
        "osascript",
        async () => clipboardCommandRunner.probeCommand("osascript"),
      ),
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
