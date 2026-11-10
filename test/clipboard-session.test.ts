import {
  initializeClipboardSession,
  prepareResolvedAttachments,
} from "../src/modules/copy/preparedAttachments";
import type { ResolvedAttachment } from "../src/modules/copy/types";
import { runSubprocessCall } from "../src/modules/copy/clipboard/commandRunner";
import { protectWindowsClipboardDirectory } from "../src/modules/copy/windowsTempPermissions";

async function windowsACLs(paths: string[]) {
  const { Subprocess } = ChromeUtils.importESModule(
    "resource://gre/modules/Subprocess.sys.mjs",
  );
  const process = await Subprocess.call({
    command: PathUtils.join(
      Services.env.get("SystemRoot"),
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    ),
    arguments: [
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle",
      "Hidden",
      "-Command",
      `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
$paths = [Console]::In.ReadToEnd() | ConvertFrom-Json
$items = @(foreach ($path in $paths) {
  $acl = (Get-Item -LiteralPath $path -Force).GetAccessControl()
  @{ protected = $acl.AreAccessRulesProtected; owner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value; rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | ForEach-Object { @{ sid = $_.IdentityReference.Value; type = $_.AccessControlType.ToString(); rights = [int]$_.FileSystemRights } }) }
})
@{ user = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value; items = $items } | ConvertTo-Json -Depth 5 -Compress
`,
    ],
    stdout: "pipe",
    stderr: "stdout",
  });
  await process.stdin.write(JSON.stringify(paths));
  await process.stdin.close();
  let output = "";
  for (let chunk; (chunk = await process.stdout.readString());) output += chunk;
  assert.equal(
    (await process.wait()).exitCode,
    0,
    "Windows ACL inspection succeeded",
  );
  return JSON.parse(output);
}

describe("clipboard session files", function () {
  it("removes previous-session files and retains current-session duplicate copies", async function () {
    this.timeout(15000);
    const stale = PathUtils.join(
      PathUtils.profileDir,
      "zotclip-clipboard",
      "session-1",
    );
    await IOUtils.makeDirectory(stale, { createAncestors: true });
    await IOUtils.writeUTF8(PathUtils.join(stale, "old.pdf"), "old fixture");
    const session = await initializeClipboardSession();
    assert.equal(await IOUtils.exists(stale), false);
    const source = PathUtils.join(
      Zotero.getTempDirectory().path,
      "zotclip-duplicate.pdf",
    );
    await IOUtils.writeUTF8(source, "duplicate fixture");
    try {
      const result = await prepareResolvedAttachments([
        { path: source },
        { path: source },
      ] as ResolvedAttachment[]);
      assert.ok(result.tempDir?.startsWith(session));
      assert.notEqual(
        result.files[0].clipboardPath,
        result.files[1].clipboardPath,
      );
      assert.equal(
        await IOUtils.readUTF8(result.files[1].clipboardPath!),
        "duplicate fixture",
      );
      assert.equal(await initializeClipboardSession(), session);
      assert.equal(await IOUtils.exists(result.files[1].clipboardPath!), true);
      const paths = [
        PathUtils.parent(session)!,
        session,
        result.tempDir!,
        result.files[1].clipboardPath!,
      ];
      if (Zotero.isWin) {
        const inspected = await windowsACLs(paths);
        assert.equal(
          inspected.items[0].protected,
          true,
          "Cache root blocks broad parent permissions",
        );
        for (const acl of inspected.items) {
          assert.equal(acl.owner, inspected.user);
          assert.deepEqual(
            acl.rules.map((rule: any) => rule.sid).sort(),
            [inspected.user, "S-1-5-18", "S-1-5-32-544"].sort(),
          );
          for (const rule of acl.rules) {
            assert.equal(rule.type, "Allow");
            assert.equal(
              rule.rights & 0x1f01ff,
              0x1f01ff,
              "Trusted principals have full control",
            );
          }
        }
      } else {
        for (const path of paths)
          assert.equal(
            (await IOUtils.stat(path)).permissions & 0o077,
            0,
            "Temporary attachment paths must be private",
          );
      }
    } finally {
      await IOUtils.remove(source, { ignoreAbsent: true });
    }
  });

  it("protects a Windows cache even under a broadly accessible parent", async function () {
    if (!Zotero.isWin) this.skip();
    this.timeout(15000);
    const parent = PathUtils.join(
      Zotero.getTempDirectory().path,
      `zotclip-acl-${Zotero.randomString(12)}`,
    );
    const target = PathUtils.join(parent, "副本 ' [test]");
    await IOUtils.makeDirectory(parent);
    const { Subprocess } = ChromeUtils.importESModule(
      "resource://gre/modules/Subprocess.sys.mjs",
    );
    try {
      const broad = await runSubprocessCall(Subprocess, {
        command: PathUtils.join(
          Services.env.get("SystemRoot"),
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        ),
        args: [
          "-NoProfile",
          "-NonInteractive",
          "-WindowStyle",
          "Hidden",
          "-Command",
          `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
$path = [Console]::In.ReadToEnd() | ConvertFrom-Json
$directory = [IO.DirectoryInfo]::new($path)
$acl = $directory.GetAccessControl()
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'), 'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
$directory.SetAccessControl($acl)
`,
        ],
        stdinText: JSON.stringify(parent),
      });
      assert.equal(broad.exitCode, 0);
      await IOUtils.makeDirectory(target);
      assert.ok(
        (await windowsACLs([target])).items[0].rules.some(
          (rule: any) => rule.sid === "S-1-1-0",
        ),
      );
      await protectWindowsClipboardDirectory(target);
      const file = PathUtils.join(target, "sample.txt");
      await IOUtils.writeUTF8(file, "synthetic file");
      const inspected = await windowsACLs([target, file, parent]);
      for (const acl of inspected.items.slice(0, 2))
        assert.deepEqual(
          acl.rules.map((rule: any) => rule.sid).sort(),
          [inspected.user, "S-1-5-18", "S-1-5-32-544"].sort(),
        );
      assert.ok(
        inspected.items[2].rules.some((rule: any) => rule.sid === "S-1-1-0"),
        "Parent ACL was not changed",
      );
    } finally {
      await IOUtils.remove(parent, { recursive: true });
    }
  });
});
