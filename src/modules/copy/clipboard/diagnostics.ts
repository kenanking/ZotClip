import type { CopyMessageArgs, CopyMessageKey } from "../types";
import type { PlatformContext } from "./platformDetection";
import { BACKEND_IDS } from "./types";

export type ClipboardDiagnosticsLineKey =
  | "copy-diagnostics-platform"
  | "copy-diagnostics-platform-linux"
  | "copy-diagnostics-command-available"
  | "copy-diagnostics-command-missing"
  | "copy-diagnostics-active-backend"
  | "copy-diagnostics-note"
  | "copy-diagnostics-install-command"
  | "copy-diagnostics-troubleshoot";

export interface ClipboardDiagnosticsLine {
  key: ClipboardDiagnosticsLineKey;
  args?: CopyMessageArgs;
  messageArgs?: CopyMessageArgs;
  messageKey?: CopyMessageKey;
}

export interface ClipboardDiagnosticsInput {
  activeBackend?: string;
  commands?: Record<string, boolean>;
  lastFallbackMessageArgs?: CopyMessageArgs;
  lastFallbackMessageKey?: CopyMessageKey;
  linuxSession?: PlatformContext["linuxSession"];
  platform: PlatformContext["platform"];
}

export interface ClipboardDiagnostics {
  activeBackend: string;
  commands: Record<string, boolean>;
  lastFallbackMessageArgs?: CopyMessageArgs;
  lastFallbackMessageKey?: CopyMessageKey;
  lines: ClipboardDiagnosticsLine[];
  linuxSession?: PlatformContext["linuxSession"];
  platform: PlatformContext["platform"];
}

export function buildClipboardDiagnostics(
  input: ClipboardDiagnosticsInput,
): ClipboardDiagnostics {
  const commands = input.commands || {};
  const activeBackend = input.activeBackend || "unknown";
  const lines: ClipboardDiagnosticsLine[] = [
    buildPlatformLine(input),
    ...Object.entries(commands).map(
      ([command, available]): ClipboardDiagnosticsLine => ({
        key: available
          ? "copy-diagnostics-command-available"
          : "copy-diagnostics-command-missing",
        args: { command },
      }),
    ),
    {
      key: "copy-diagnostics-active-backend",
      args: { backend: activeBackend },
    },
  ];

  if (input.lastFallbackMessageKey) {
    lines.push({
      key: "copy-diagnostics-note",
      messageKey: input.lastFallbackMessageKey,
      messageArgs: input.lastFallbackMessageArgs,
    });
  }

  const installCommand = buildInstallCommand(input);
  if (installCommand) {
    lines.push({
      key: "copy-diagnostics-install-command",
      args: { command: installCommand },
    });
    lines.push({
      key: "copy-diagnostics-troubleshoot",
    });
  }

  return {
    platform: input.platform,
    linuxSession: input.linuxSession,
    commands,
    activeBackend,
    lastFallbackMessageKey: input.lastFallbackMessageKey,
    lastFallbackMessageArgs: input.lastFallbackMessageArgs,
    lines,
  };
}

function buildPlatformLine(
  input: ClipboardDiagnosticsInput,
): ClipboardDiagnosticsLine {
  if (input.platform === "linux") {
    return {
      key: "copy-diagnostics-platform-linux",
      args: { session: input.linuxSession || "unknown" },
    };
  }

  return {
    key: "copy-diagnostics-platform",
    args: { platform: input.platform },
  };
}

function buildInstallCommand(
  input: ClipboardDiagnosticsInput,
): string | undefined {
  if (input.platform !== "linux") {
    return undefined;
  }

  if (input.activeBackend && input.activeBackend !== BACKEND_IDS.FALLBACK) {
    return undefined;
  }

  const commands = input.commands || {};

  if (input.linuxSession === "wayland" && commands["wl-copy"] === false) {
    return "sudo apt install wl-clipboard";
  }

  if (input.linuxSession === "x11" && commands["gtk4-helper"] === false) {
    return "sudo apt install python3-gi gir1.2-gtk-4.0";
  }

  if (commands["gtk4-helper"] === false) {
    return "sudo apt install python3-gi gir1.2-gtk-4.0";
  }

  if (commands["wl-copy"] === false) {
    return "sudo apt install wl-clipboard";
  }

  return undefined;
}
