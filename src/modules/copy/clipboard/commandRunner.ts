export interface CommandCall {
  command: string;
  args: string[];
  stdinText?: string;
}

export interface CommandResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  process?: { exited: Promise<{ exitCode: number }>; terminate(): void };
}

export interface StartCommandOptions {
  startupTimeoutMs?: number;
  readyMessage?: string;
}

interface LowLevelCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface SubprocessReaderLike {
  readString(): Promise<string>;
}

interface SubprocessWriterLike {
  close(): Promise<unknown>;
  write(value: string): Promise<unknown>;
}

interface SubprocessProcessLike {
  stderr?: SubprocessReaderLike;
  stdin?: SubprocessWriterLike;
  stdout?: SubprocessReaderLike;
  wait(): Promise<{ exitCode: number }>;
  kill?(timeout?: number): void;
}

interface SubprocessLike {
  call(options: {
    arguments: string[];
    command: string;
    stderr: "pipe";
    stdout: "pipe";
  }): Promise<SubprocessProcessLike>;
}

export interface CommandRunner {
  probeCommand(name: string): Promise<boolean>;
  runCommand(call: CommandCall): Promise<CommandResult>;
  startCommand(
    call: CommandCall,
    options?: StartCommandOptions,
  ): Promise<CommandResult>;
}

export interface CommandRunnerDeps {
  getEnv?(name: string): string | undefined;
  isExecutablePath?(path: string): boolean;
  runProcess?(call: CommandCall): Promise<LowLevelCommandResult>;
  startProcess?(call: CommandCall): Promise<SubprocessProcessLike>;
}

export function createCommandRunner(
  deps: CommandRunnerDeps = {},
): CommandRunner {
  const getEnv = deps.getEnv || defaultGetEnv;
  const isExecutablePath = deps.isExecutablePath || defaultIsExecutablePath;
  const runProcess = deps.runProcess || defaultRunProcess;
  const startProcess = deps.startProcess || defaultStartProcess;
  const resolvedCommandPathCache = new Map<string, string | undefined>();

  const getResolvedCommandPath = (name: string): string | undefined => {
    if (!resolvedCommandPathCache.has(name)) {
      resolvedCommandPathCache.set(
        name,
        resolveCommandPath(name, getEnv, isExecutablePath),
      );
    }

    return resolvedCommandPathCache.get(name);
  };

  return {
    async probeCommand(name: string): Promise<boolean> {
      try {
        return getResolvedCommandPath(name) !== undefined;
      } catch {
        return false;
      }
    },
    async runCommand(call: CommandCall): Promise<CommandResult> {
      try {
        const resolvedCall = resolveCommandCall(call, getResolvedCommandPath);
        const result = await runProcess(resolvedCall);
        return buildCommandResult(
          result.exitCode === 0,
          result.exitCode,
          result.stdout,
          result.stderr,
        );
      } catch (error) {
        return buildThrownCommandResult(error);
      }
    },
    async startCommand(
      call: CommandCall,
      options: StartCommandOptions = {},
    ): Promise<CommandResult> {
      try {
        const resolvedCall = resolveCommandCall(call, getResolvedCommandPath);
        const process = await startProcess(resolvedCall);
        return await startRunningProcess(process, resolvedCall, options);
      } catch (error) {
        return buildThrownCommandResult(error);
      }
    },
  };
}

function resolveCommandCall(
  call: CommandCall,
  resolveCommandPathCached: (name: string) => string | undefined,
): CommandCall {
  const resolvedCommand = resolveCommandPathCached(call.command);
  if (!resolvedCommand) {
    throw new Error(`Command not found: ${call.command}`);
  }

  return {
    ...call,
    command: resolvedCommand,
  };
}

function resolveCommandPath(
  name: string,
  getEnv: (name: string) => string | undefined,
  isExecutablePath: (path: string) => boolean,
): string | undefined {
  const candidates = name.includes("/")
    ? [name]
    : splitPathEntries(getEnv("PATH")).map((dir) =>
        joinExecutablePath(dir, name),
      );

  return candidates.find((path) => isExecutablePath(path));
}

async function defaultRunProcess(
  call: CommandCall,
): Promise<LowLevelCommandResult> {
  const process = await defaultStartProcess(call);
  return collectProcessResult(process, call.stdinText);
}

async function defaultStartProcess(
  call: CommandCall,
): Promise<SubprocessProcessLike> {
  const { Subprocess } = ChromeUtils.importESModule(
    "resource://gre/modules/Subprocess.sys.mjs",
  ) as any;

  return subprocessCall(Subprocess, call);
}

export async function runSubprocessCall(
  subprocess: SubprocessLike,
  call: CommandCall,
): Promise<LowLevelCommandResult> {
  const process = await subprocessCall(subprocess, call);
  return collectProcessResult(process, call.stdinText);
}

export async function startSubprocessCall(
  subprocess: SubprocessLike,
  call: CommandCall,
  options: StartCommandOptions = {},
): Promise<CommandResult> {
  const process = await subprocessCall(subprocess, call);
  return startRunningProcess(process, call, options);
}

async function subprocessCall(
  subprocess: SubprocessLike,
  call: CommandCall,
): Promise<SubprocessProcessLike> {
  return subprocess.call({
    command: call.command,
    arguments: call.args,
    stderr: "pipe",
    stdout: "pipe",
  });
}

async function collectProcessResult(
  process: SubprocessProcessLike,
  stdinText?: string,
): Promise<LowLevelCommandResult> {
  await writeProcessStdin(process, stdinText);

  const [{ exitCode }, stdout, stderr] = await Promise.all([
    process.wait(),
    process.stdout?.readString() || Promise.resolve(""),
    process.stderr?.readString() || Promise.resolve(""),
  ]);

  return {
    exitCode,
    stdout,
    stderr,
  };
}

const clipboardProcesses = new Set<() => void>();

export function stopClipboardProcesses(): void {
  for (const stop of clipboardProcesses) stop();
  clipboardProcesses.clear();
}

async function startRunningProcess(
  process: SubprocessProcessLike,
  call: CommandCall,
  options: StartCommandOptions,
): Promise<CommandResult> {
  let stopped = false;
  const terminate = () => {
    if (stopped) return;
    stopped = true;
    process.kill?.(1000);
    clipboardProcesses.delete(terminate);
  };
  clipboardProcesses.add(terminate);
  const exited = process.wait();
  void exited
    .finally(() => clipboardProcesses.delete(terminate))
    .catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stderr =
    process.stderr?.readString().catch(() => "") ?? Promise.resolve("");
  try {
    await writeProcessStdin(process, call.stdinText);
    const ready = (async () => {
      let output = "";
      while (output.length < 4096) {
        const chunk = await process.stdout?.readString();
        if (!chunk) throw new Error("Clipboard helper closed before readiness");
        output += chunk;
        if (output.includes(options.readyMessage || "ZOTCLIP_READY")) return;
      }
      throw new Error("Invalid clipboard helper readiness response");
    })();
    await Promise.race([
      ready,
      exited.then(() => {
        throw new Error("Clipboard helper exited before readiness");
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Clipboard helper startup timed out")),
          options.startupTimeoutMs ?? 5000,
        );
      }),
    ]);
    void stderr;
    return {
      ...buildCommandResult(true, 0, "", ""),
      process: { exited, terminate },
    };
  } catch (error) {
    terminate();
    return buildThrownCommandResult(error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function writeProcessStdin(
  process: SubprocessProcessLike,
  stdinText?: string,
): Promise<void> {
  if (stdinText === undefined) {
    return;
  }

  await process.stdin?.write(stdinText);
  await process.stdin?.close();
}

function defaultGetEnv(name: string): string | undefined {
  return Services.env.get(name);
}

function defaultIsExecutablePath(path: string): boolean {
  try {
    const file = getXPCOMClasses()["@mozilla.org/file/local;1"].createInstance(
      Components.interfaces.nsIFile,
    ) as any;
    file.initWithPath(path);
    return file.exists() && file.isFile() && file.isExecutable();
  } catch {
    return false;
  }
}

function splitPathEntries(pathValue: string | undefined): string[] {
  if (!pathValue) {
    return [];
  }

  return pathValue.split(":").filter((entry) => entry.length > 0);
}

function joinExecutablePath(dir: string, name: string): string {
  return dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`;
}

function getXPCOMClasses(): any {
  return Components.classes as any;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function buildThrownCommandResult(error: unknown): CommandResult {
  return buildCommandResult(false, -1, "", getErrorMessage(error));
}

function buildCommandResult(
  ok: boolean,
  exitCode: number,
  stdout: string,
  stderr: string,
): CommandResult {
  return {
    ok,
    exitCode,
    stdout,
    stderr,
  };
}
