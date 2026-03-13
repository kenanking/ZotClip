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
}

export interface StartCommandOptions {
  startupTimeoutMs?: number;
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

  return {
    async probeCommand(name: string): Promise<boolean> {
      try {
        return resolveCommandPath(name, getEnv, isExecutablePath) !== undefined;
      } catch {
        return false;
      }
    },
    async runCommand(call: CommandCall): Promise<CommandResult> {
      try {
        const resolvedCall = resolveCommandCall(call, getEnv, isExecutablePath);
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
        const resolvedCall = resolveCommandCall(call, getEnv, isExecutablePath);
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
  getEnv: (name: string) => string | undefined,
  isExecutablePath: (path: string) => boolean,
): CommandCall {
  const resolvedCommand = resolveCommandPath(
    call.command,
    getEnv,
    isExecutablePath,
  );
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

async function startRunningProcess(
  process: SubprocessProcessLike,
  call: CommandCall,
  options: StartCommandOptions,
): Promise<CommandResult> {
  await writeProcessStdin(process, call.stdinText);

  const stdoutPromise = process.stdout?.readString() || Promise.resolve("");
  const stderrPromise = process.stderr?.readString() || Promise.resolve("");
  const exitPromise = process.wait();
  const startupTimeoutMs = options.startupTimeoutMs ?? 150;
  const startupState = await Promise.race([
    exitPromise.then(({ exitCode }) => ({
      kind: "exited" as const,
      exitCode,
    })),
    waitForDelay(startupTimeoutMs).then(() => ({
      kind: "started" as const,
    })),
  ]);

  if (startupState.kind === "started") {
    void monitorStartedProcess(call, exitPromise, stdoutPromise, stderrPromise);
    return buildCommandResult(true, 0, "", "");
  }

  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  return buildCommandResult(
    false,
    startupState.exitCode,
    stdout,
    stderr || "Command exited before startup completed.",
  );
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

async function monitorStartedProcess(
  call: CommandCall,
  exitPromise: Promise<{ exitCode: number }>,
  stdoutPromise: Promise<string>,
  stderrPromise: Promise<string>,
): Promise<void> {
  try {
    const { exitCode } = await exitPromise;
    if (exitCode === 0) {
      return;
    }

    const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
    ztoolkit.log("Background command exited", {
      call,
      exitCode,
      stdout,
      stderr,
    });
  } catch (error) {
    ztoolkit.log("Background command monitoring failed", error);
  }
}

function waitForDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
