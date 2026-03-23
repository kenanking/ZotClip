import { runClipboardBackends } from "./clipboard/backendRegistry";
import type { ClipboardBackend } from "./clipboard/backends";
import type {
  CommandCall,
  CommandResult,
  StartCommandOptions,
} from "./clipboard/commandRunner";
import { createCommandRunner } from "./clipboard/commandRunner";
import {
  buildLinuxGtkProbeCall,
  createLinuxGtkBackend,
} from "./clipboard/linuxGtkBackend";
import { createLinuxWaylandBackend } from "./clipboard/linuxWaylandBackend";
import { createMacosCommandBackend } from "./clipboard/macosCommandBackend";
import { createPathTextBackend } from "./clipboard/pathTextBackend";
import { buildClipboardPayload } from "./clipboard/payload";
import type { ClipboardSource } from "./clipboard/types";
import {
  detectCurrentPlatformContext,
  type PlatformContext,
} from "./clipboard/platformDetection";
import {
  getClipboardRuntimeCache,
  type ClipboardRuntimeCache,
} from "./clipboard/runtimeCache";
import { createWindowsBackend } from "./clipboard/windowsBackend";
import {
  prepareResolvedAttachments,
  scheduleTempDirCleanup,
} from "./preparedAttachments";
import type { PreparedAttachmentResult } from "./preparedAttachments";
import type { ClipboardResult, ResolvedAttachment } from "./types";
import { writeWindowsFileDrop } from "./windowsFileClipboard";

const COMMAND_RUNNER_UNAVAILABLE_MESSAGE = "Command runner unavailable.";

export interface ClipboardWriterDeps {
  detectPlatformContext?(): PlatformContext;
  prepareResolvedAttachments?(
    files: ResolvedAttachment[],
  ): Promise<PreparedAttachmentResult | ResolvedAttachment[]>;
  runtimeCache?: ClipboardRuntimeCache;
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
  source: ClipboardSource = "library",
  deps: ClipboardWriterDeps = DEFAULT_DEPS,
): Promise<ClipboardResult> {
  const runtimeCache = deps.runtimeCache || getClipboardRuntimeCache();
  const prepareResult = await deps.prepareResolvedAttachments?.(files);
  const { preparedFiles, tempDir } = extractPrepareResult(prepareResult, files);
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

  const platformContext = getPlatformContext(deps, runtimeCache);

  const backends =
    platformContext.platform === "windows"
      ? buildWindowsBackends(deps)
      : platformContext.platform === "linux"
        ? buildLinuxBackends(platformContext, deps, runtimeCache)
        : buildMacosBackends(deps, runtimeCache);

  const result = await runClipboardBackends({
    payload,
    backends,
  });

  invalidateRuntimeCacheOnBackendFailure(runtimeCache, platformContext, result);
  if (tempDir) {
    scheduleTempDirCleanup(tempDir);
  }
  return result;
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
  runtimeCache: ClipboardRuntimeCache,
): ClipboardBackend[] {
  const commandDeps = buildCommandDeps(deps, runtimeCache);
  const linuxBackends =
    platformContext.linuxSession === "wayland"
      ? [
          createLinuxWaylandBackend(commandDeps),
          createLinuxGtkBackend(commandDeps),
        ]
      : platformContext.linuxSession === "x11"
        ? [
            createLinuxGtkBackend(commandDeps),
            createLinuxWaylandBackend(commandDeps),
          ]
        : [
            createLinuxGtkBackend(commandDeps),
            createLinuxWaylandBackend(commandDeps),
          ];

  return [...linuxBackends, ...buildLinuxFallbackBackends(deps)];
}

function buildMacosBackends(
  deps: ClipboardWriterDeps,
  runtimeCache: ClipboardRuntimeCache,
): ClipboardBackend[] {
  return [
    createMacosCommandBackend(buildCommandDeps(deps, runtimeCache)),
    buildPathTextBackend(deps),
  ];
}

function buildCommandDeps(
  deps: ClipboardWriterDeps,
  runtimeCache: ClipboardRuntimeCache,
): {
  probeGtkSupport(): Promise<boolean>;
  probeCommand(name: string): Promise<boolean>;
  runCommand(call: CommandCall): Promise<CommandResult>;
  startCommand(
    call: CommandCall,
    options?: StartCommandOptions,
  ): Promise<CommandResult>;
} {
  return {
    probeGtkSupport: async () =>
      runtimeCache.getLinuxGtkAvailability(async () => {
        const result = await deps.runCommand?.(buildLinuxGtkProbeCall());
        return result?.ok ?? false;
      }),
    probeCommand: async (name) =>
      runtimeCache.getCommandAvailability(
        name,
        async () => (await deps.probeCommand?.(name)) ?? false,
      ),
    runCommand: async (call) =>
      (await deps.runCommand?.(call)) || buildUnavailableCommandResult(),
    startCommand: async (call, options) =>
      (await deps.startCommand?.(call, options)) ||
      buildUnavailableCommandResult(),
  };
}

function getPlatformContext(
  deps: ClipboardWriterDeps,
  runtimeCache: ClipboardRuntimeCache,
): PlatformContext {
  return runtimeCache.getPlatformContext(
    () =>
      deps.detectPlatformContext?.() || {
        platform: "linux" as const,
        linuxSession: "unknown" as const,
      },
  );
}

function buildPathTextBackend(deps: ClipboardWriterDeps): ClipboardBackend {
  return createPathTextBackend({
    writePathText: (value) => deps.writePathText(value),
  });
}

function extractPrepareResult(
  result: PreparedAttachmentResult | ResolvedAttachment[] | undefined,
  fallback: ResolvedAttachment[],
): { preparedFiles: ResolvedAttachment[]; tempDir?: string } {
  if (!result) {
    return { preparedFiles: fallback };
  }
  if (Array.isArray(result)) {
    return { preparedFiles: result };
  }
  return { preparedFiles: result.files, tempDir: result.tempDir };
}

function buildUnavailableCommandResult(): CommandResult {
  return {
    ok: false,
    exitCode: -1,
    stdout: "",
    stderr: COMMAND_RUNNER_UNAVAILABLE_MESSAGE,
  };
}

function invalidateRuntimeCacheOnBackendFailure(
  runtimeCache: ClipboardRuntimeCache,
  platformContext: PlatformContext,
  result: ClipboardResult,
): void {
  if (result.ok && result.format !== "path-text") {
    return;
  }

  if (platformContext.platform === "linux") {
    runtimeCache.invalidateLinuxGtkAvailability();
    runtimeCache.invalidateCommandAvailability("wl-copy");
    return;
  }

  if (platformContext.platform === "macos") {
    runtimeCache.invalidateCommandAvailability("osascript");
  }
}
