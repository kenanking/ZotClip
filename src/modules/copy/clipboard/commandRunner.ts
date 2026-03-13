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

interface LowLevelCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  probeCommand(name: string): Promise<boolean>;
  runCommand(call: CommandCall): Promise<CommandResult>;
}

export interface CommandRunnerDeps {
  runProcess?(call: CommandCall): Promise<LowLevelCommandResult>;
}

export function buildProbeCommand(name: string): CommandCall {
  return {
    command: "/bin/sh",
    args: ["-lc", `command -v -- ${name}`],
  };
}

export function createCommandRunner(
  deps: CommandRunnerDeps = {},
): CommandRunner {
  const runProcess = deps.runProcess || defaultRunProcess;

  return {
    async probeCommand(name: string): Promise<boolean> {
      const result = await runProcess(buildProbeCommand(name));
      return result.exitCode === 0;
    },
    async runCommand(call: CommandCall): Promise<CommandResult> {
      const result = await runProcess(call);
      return {
        ok: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    },
  };
}

async function defaultRunProcess(
  call: CommandCall,
): Promise<LowLevelCommandResult> {
  const { Subprocess } = ChromeUtils.importESModule(
    "resource://gre/modules/Subprocess.sys.mjs",
  ) as any;

  const process = await Subprocess.call({
    command: call.command,
    arguments: call.args,
    stderr: "pipe",
    stdin: call.stdinText || undefined,
    stdout: "pipe",
  });

  return {
    exitCode: process.exitCode,
    stdout: await process.stdout.readString(),
    stderr: await process.stderr.readString(),
  };
}
