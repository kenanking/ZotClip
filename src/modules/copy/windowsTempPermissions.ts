import { runSubprocessCall } from "./clipboard/commandRunner";

export async function protectWindowsClipboardDirectory(
  path: string,
): Promise<void> {
  const { Subprocess } = ChromeUtils.importESModule(
    "resource://gre/modules/Subprocess.sys.mjs",
  );
  const result = await runSubprocessCall(Subprocess, {
    command: PathUtils.join(
      Services.env.get("SystemRoot"),
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    ),
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-Command",
      `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
$targetPath = [Console]::In.ReadToEnd() | ConvertFrom-Json
$directory = [IO.DirectoryInfo]::new($targetPath)
if (!$directory.Exists -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw 'Clipboard directory must be a real directory'
}
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @($currentUser, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
}
$directory.SetAccessControl($acl)
`,
    ],
    stdinText: JSON.stringify(path),
  });
  if (result.exitCode !== 0)
    throw new Error("Could not secure the ZotClip clipboard directory");
}
