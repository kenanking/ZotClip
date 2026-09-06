import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import console from "node:console";

const version = process.argv[2];
if (!["8.0.4", "9.0.6", "10.0.1"].includes(version)) {
  throw new Error("Choose a pinned Linux test version: 8.0.4, 9.0.6, 10.0.1");
}
if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error("This download runner requires Linux x64.");
}
const runtime = resolve(".scaffold/runtimes", version);
mkdirSync(runtime, { recursive: true });
const binary = resolve(runtime, "Zotero_linux-x86_64/zotero");
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!existsSync(binary)) {
  const archive = resolve(runtime, "zotero.tar.xz");
  run("curl", [
    "--fail",
    "--location",
    "--retry",
    "3",
    "--output",
    archive,
    `https://download.zotero.org/client/release/${version}/Zotero-${version}_linux-x86_64.tar.xz`,
  ]);
  run("tar", ["-xf", archive, "-C", runtime]);
}
const application = readFileSync(
  resolve(runtime, "Zotero_linux-x86_64/app/application.ini"),
  "utf8",
);
if (!application.includes(`Version=${version}\n`))
  throw new Error("Unexpected Zotero version");
console.log(
  `Testing Zotero ${version}; scaffold creates a fresh isolated profile and database.`,
);
if (!process.argv.includes("--download-only")) {
  run("npm", ["run", "test"], {
    timeout: 300_000,
    env: {
      ...process.env,
      ZOTERO_PLUGIN_ZOTERO_BIN_PATH: binary,
      ZOTCLIP_TEST_HEADLESS: "1",
      ZOTCLIP_TEST_VERSION: version,
    },
  });
}
