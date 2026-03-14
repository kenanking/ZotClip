import { runClipboardBackends } from "./clipboard/backendRegistry";
import type { ClipboardBackend } from "./clipboard/backends";
import type {
  CommandCall,
  CommandResult,
  StartCommandOptions,
} from "./clipboard/commandRunner";
import { createCommandRunner } from "./clipboard/commandRunner";
import { createLinuxGtkBackend } from "./clipboard/linuxGtkBackend";
import { createLinuxWaylandBackend } from "./clipboard/linuxWaylandBackend";
import { createMacosCommandBackend } from "./clipboard/macosCommandBackend";
import { createPathTextBackend } from "./clipboard/pathTextBackend";
import { buildClipboardPayload } from "./clipboard/payload";
import {
  detectCurrentPlatformContext,
  type PlatformContext,
} from "./clipboard/platformDetection";
import { createWindowsBackend } from "./clipboard/windowsBackend";
import { prepareResolvedAttachments } from "./preparedAttachments";
import type { ClipboardResult, ResolvedAttachment } from "./types";
import { writeWindowsFileDrop } from "./windowsFileClipboard";

const COMMAND_RUNNER_UNAVAILABLE_MESSAGE = "Command runner unavailable.";

export interface ClipboardWriterDeps {
  detectPlatformContext?(): PlatformContext;
  prepareResolvedAttachments?(
    files: ResolvedAttachment[],
  ): Promise<ResolvedAttachment[]>;
  probeCommand?(name: string): Promise<boolean>;
  runCommand?(call: CommandCall): Promise<CommandResult>;
  startCommand?(
    call: CommandCall,
    options?: StartCommandOptions,
  ): Promise<CommandResult>;
  writeWindowsFileDrop?(paths: string[]): Promise<boolean> | boolean;
  writePathText(value: string): boolean;
}

const commandRunner = createCommandRunner();

const DEFAULT_DEPS: ClipboardWriterDeps = {
  detectPlatformContext: () => detectCurrentPlatformContext(),
  prepareResolvedAttachments: (files) => prepareResolvedAttachments(files),
  probeCommand: (name) => commandRunner.probeCommand(name),
  runCommand: (call) => commandRunner.runCommand(call),
  startCommand: (call, options) => commandRunner.startCommand(call, options),
  writeWindowsFileDrop: async (paths) => writeWindowsFileDrop(paths),
  writePathText: (value) => {
    if (!value) {
      return false;
    }

    try {
      Zotero.Utilities.Internal.copyTextToClipboard(value);
      return true;
    } catch (error) {
      ztoolkit.log("writePathText failed", error);
      return false;
    }
  },
};

export async function writeClipboard(
  files: ResolvedAttachment[],
  source: "library" | "reader" = "library",
  deps: ClipboardWriterDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  const preparedFiles =
    (await deps.prepareResolvedAttachments?.(files)) || files;
  const payload = buildClipboardPayload(preparedFiles, source);
  if (!payload.paths.length) {
    return {
      ok: false,
      format: "none",
      count: 0,
      outcome: "backend-unavailable",
      messageKey: "copy-no-files",
    };
  }

  const platformContext = getPlatformContext(deps);

  const backends =
    platformContext.platform === "windows"
      ? buildWindowsBackends(deps)
      : platformContext.platform === "linux"
        ? buildLinuxBackends(platformContext, deps)
        : buildMacosBackends(deps);

  return runClipboardBackends({
    payload,
    backends,
  });
}

function buildWindowsBackends(deps: ClipboardWriterDeps): ClipboardBackend[] {
  return [
    createWindowsBackend({
      writeWindowsFileDrop: async (paths) =>
        !!(await deps.writeWindowsFileDrop?.(paths)),
    }),
    buildPathTextBackend(deps),
  ];
}

function buildLinuxFallbackBackends(
  deps: ClipboardWriterDeps,
): ClipboardBackend[] {
  return [buildPathTextBackend(deps)];
}

function buildLinuxBackends(
  platformContext: PlatformContext,
  deps: ClipboardWriterDeps,
): ClipboardBackend[] {
  const commandDeps = buildCommandDeps(deps);
  const linuxBackends =
    platformContext.linuxSession === "wayland"
      ? [createLinuxWaylandBackend(commandDeps)]
      : platformContext.linuxSession === "x11"
        ? [createLinuxGtkBackend(commandDeps)]
        : [
            createLinuxGtkBackend(commandDeps),
            createLinuxWaylandBackend(commandDeps),
          ];

  return [...linuxBackends, ...buildLinuxFallbackBackends(deps)];
}

function buildMacosBackends(deps: ClipboardWriterDeps): ClipboardBackend[] {
  return [
    createMacosCommandBackend(buildCommandDeps(deps)),
    buildPathTextBackend(deps),
  ];
}

function buildCommandDeps(deps: ClipboardWriterDeps): {
  probeCommand(name: string): Promise<boolean>;
  runCommand(call: CommandCall): Promise<CommandResult>;
  startCommand(
    call: CommandCall,
    options?: StartCommandOptions,
  ): Promise<CommandResult>;
} {
  return {
    probeCommand: async (name) => (await deps.probeCommand?.(name)) ?? false,
    runCommand: async (call) =>
      (await deps.runCommand?.(call)) || buildUnavailableCommandResult(),
    startCommand: async (call, options) =>
      (await deps.startCommand?.(call, options)) ||
      buildUnavailableCommandResult(),
  };
}

function getPlatformContext(deps: ClipboardWriterDeps): PlatformContext {
  return (
    deps.detectPlatformContext?.() || {
      platform: "linux" as const,
      linuxSession: "unknown" as const,
    }
  );
}

function buildPathTextBackend(deps: ClipboardWriterDeps): ClipboardBackend {
  return createPathTextBackend({
    writePathText: (value) => deps.writePathText(value),
  });
}

function buildUnavailableCommandResult(): CommandResult {
  return {
    ok: false,
    exitCode: -1,
    stdout: "",
    stderr: COMMAND_RUNNER_UNAVAILABLE_MESSAGE,
  };
}
