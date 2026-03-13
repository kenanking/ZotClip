import type { PlatformContext } from "./platformDetection";

export interface ClipboardDiagnosticsInput {
  activeBackend?: string;
  commands?: Record<string, boolean>;
  lastFallbackReason?: string;
  linuxSession?: PlatformContext["linuxSession"];
  platform: PlatformContext["platform"];
}

export interface ClipboardDiagnostics {
  activeBackend: string;
  commands: Record<string, boolean>;
  lastFallbackReason?: string;
  lines: string[];
  linuxSession?: PlatformContext["linuxSession"];
  platform: PlatformContext["platform"];
}

export function buildClipboardDiagnostics(
  input: ClipboardDiagnosticsInput,
): ClipboardDiagnostics {
  const commands = input.commands || {};
  const activeBackend = input.activeBackend || "unknown";
  const lines = [
    buildPlatformLine(input),
    ...Object.entries(commands).map(
      ([command, available]) =>
        `${command}: ${available ? "available" : "missing"}`,
    ),
    `Active backend: ${activeBackend}`,
  ];

  if (input.lastFallbackReason) {
    lines.push(`Note: ${input.lastFallbackReason}`);
  }

  return {
    platform: input.platform,
    linuxSession: input.linuxSession,
    commands,
    activeBackend,
    lastFallbackReason: input.lastFallbackReason,
    lines,
  };
}

function buildPlatformLine(input: ClipboardDiagnosticsInput): string {
  if (input.platform === "linux") {
    return `Platform: linux (${input.linuxSession || "unknown"})`;
  }

  return `Platform: ${input.platform}`;
}
