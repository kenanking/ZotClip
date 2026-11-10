import { config, version } from "../../../package.json";
import {
  getAiApiKeyForProvider,
  listAiCredentials,
  setAiApiKeyForProvider,
} from "../tagging/credentials/zoteroCredentials";
import { readPackage, writePackage } from "./package";
import {
  isMachinePath,
  isOwnPreference,
  MAX_ENTRIES,
  MAX_FILE_BYTES,
  portablePreference,
  validCredential,
  validPreferenceValue,
  validRelativePath,
} from "./policy";
import {
  entryLabel,
  type Category,
  type Entry,
  type FileEntry,
  type Manifest,
  type Progress,
} from "./types";

function addonManager() {
  return ChromeUtils.importESModule(
    "resource://gre/modules/AddonManager.sys.mjs",
  ).AddonManager;
}
function manifest(
  entries: Entry[],
  omitted: string[],
  recovery = false,
): Manifest {
  return {
    format: 1,
    createdAt: new Date().toISOString(),
    source: {
      zotero: Zotero.version,
      zotclip: version,
      platform: Zotero.isWin ? "Windows" : Zotero.isMac ? "macOS" : "Linux",
    },
    entries,
    omitted,
    recovery,
  };
}
function fileKey(entry: FileEntry): string {
  return `${entry.category}/${entry.path}`;
}
function resourcePath(entry: FileEntry): string {
  return PathUtils.join(
    Zotero.DataDirectory.dir,
    entry.category,
    ...entry.path.split("/"),
  );
}
async function bytes(path: string): Promise<Uint8Array<ArrayBuffer>> {
  if ((await IOUtils.stat(path)).size! > MAX_FILE_BYTES)
    throw new Error("migration-too-large");
  return new Uint8Array(await IOUtils.read(path));
}
async function assertSafeDestination(entry: FileEntry): Promise<string> {
  let path = Zotero.DataDirectory.dir;
  for (const part of [entry.category, ...entry.path.split("/")]) {
    path = PathUtils.join(path, part);
    const file = Zotero.File.pathToFile(path);
    if (file.isSymlink()) throw new Error("migration-unsafe-path");
  }
  if (
    (await IOUtils.exists(path)) &&
    (await IOUtils.stat(path)).type !== "regular"
  )
    throw new Error("migration-unsafe-path");
  return path;
}
function addonFile(addon: any): string | undefined {
  const uri = addon.getResourceURI("");
  if (uri.scheme !== "jar") return;
  const jar = uri.QueryInterface(Components.interfaces.nsIJARURI);
  if (jar.JARFile.scheme !== "file") return;
  return jar.JARFile.QueryInterface(Components.interfaces.nsIFileURL).file.path;
}
function eligibleAddon(addon: any): boolean {
  return Boolean(
    addon.id &&
    addon.type === "extension" &&
    !addon.isSystem &&
    !addon.isBuiltin &&
    !addon.temporarilyInstalled &&
    addon.id !== config.addonID &&
    !/^Zotero(?:WinWord|MacWord|OpenOffice)Integration@/i.test(addon.id),
  );
}

export interface Collection {
  manifest: Manifest;
  files: Map<string, string>;
}
export async function collectConfiguration(
  selected: ReadonlySet<Category>,
  signal?: AbortSignal,
): Promise<Collection> {
  const entries: Entry[] = [];
  const omitted: string[] = [];
  const files = new Map<string, string>();
  if (selected.has("preferences")) {
    for (const name of Services.prefs.getChildList("extensions.").sort()) {
      if (
        !portablePreference(name) ||
        (!Services.prefs.prefHasUserValue(name) && !isOwnPreference(name))
      )
        continue;
      const value = Zotero.Prefs.get(name, true);
      if (!validPreferenceValue(value)) continue;
      entries.push({
        kind: isMachinePath(name, value) ? "path" : "preference",
        name,
        value,
      });
    }
  }
  if (selected.has("credentials")) {
    for (const credential of await listAiCredentials()) {
      if (validCredential(credential.provider, credential.origin))
        entries.push({ kind: "credential", ...credential });
    }
  }
  if (selected.has("addons")) {
    for (const addon of await addonManager().getAllAddons()) {
      if (!eligibleAddon(addon)) continue;
      const path = addonFile(addon);
      if (!path || !(await IOUtils.exists(path))) {
        omitted.push(addon.id);
        continue;
      }
      const entry: FileEntry = {
        kind: "file",
        category: "addons",
        path: `${addon.id}.xpi`,
        size: (await IOUtils.stat(path)).size!,
        addon: {
          id: addon.id,
          version: addon.version,
          disabled: Boolean(addon.userDisabled),
        },
      };
      entries.push(entry);
      files.set(fileKey(entry), path);
    }
  }
  for (const category of ["styles", "translators", "locate"] as const) {
    if (!selected.has(category)) continue;
    const root = PathUtils.join(Zotero.DataDirectory.dir, category);
    if (!(await IOUtils.exists(root))) continue;
    const queue = [{ directory: root, relative: "" }];
    while (queue.length) {
      signal?.throwIfAborted();
      const { directory, relative } = queue.shift()!;
      if (Zotero.File.pathToFile(directory).isSymlink()) {
        omitted.push(`${category}/${relative}`);
        continue;
      }
      for (const path of (await IOUtils.getChildren(directory)).sort()) {
        const name = PathUtils.filename(path);
        const relativePath = relative ? `${relative}/${name}` : name;
        if (
          !validRelativePath(relativePath) ||
          Zotero.File.pathToFile(path).isSymlink()
        ) {
          omitted.push(`${category}/${relativePath}`);
          continue;
        }
        const stat = await IOUtils.stat(path);
        if (stat.type === "directory")
          queue.push({ directory: path, relative: relativePath });
        else if (stat.type === "regular") {
          const entry: FileEntry = {
            kind: "file",
            category,
            path: relativePath,
            size: stat.size!,
          };
          entries.push(entry);
          files.set(fileKey(entry), path);
        }
        if (entries.length + queue.length > MAX_ENTRIES)
          throw new Error("migration-too-large");
      }
    }
  }
  signal?.throwIfAborted();
  return { manifest: manifest(entries, omitted), files };
}

export async function exportConfiguration(
  crypto: Crypto,
  collection: Collection,
  password: string,
  destination: string,
  signal?: AbortSignal,
  progress?: Progress,
): Promise<void> {
  if (await IOUtils.exists(destination))
    throw new Error("migration-output-exists");
  const temporary = `${destination}.${Zotero.randomString(12)}.tmp`;
  try {
    await IOUtils.write(temporary, new Uint8Array(), { mode: "create" });
    await IOUtils.setPermissions(temporary, 0o600);
    await writePackage(
      crypto,
      password,
      collection.manifest,
      (entry) => bytes(collection.files.get(fileKey(entry))!),
      async (data) => {
        await IOUtils.write(temporary, data, { mode: "append" });
      },
      signal,
      progress,
    );
    signal?.throwIfAborted();
    await IOUtils.move(temporary, destination, { noOverwrite: true });
  } finally {
    await IOUtils.remove(temporary, { ignoreAbsent: true });
  }
}

export interface OpenPackage extends Collection {
  dispose(): Promise<void>;
}
export async function openPackage(
  crypto: Crypto,
  path: string,
  password: string,
  signal?: AbortSignal,
  progress?: Progress,
): Promise<OpenPackage> {
  const directory = PathUtils.join(
    Zotero.getTempDirectory().path,
    `zotclip-migration-${Zotero.randomString(16)}`,
  );
  await IOUtils.makeDirectory(directory, { permissions: 0o700 });
  const files = new Map<string, string>();
  const dispose = () =>
    IOUtils.remove(directory, { recursive: true, ignoreAbsent: true });
  try {
    const source = Zotero.File.pathToFile(path);
    if (source.isSymlink() || !source.isFile())
      throw new Error("migration-invalid-package");
    const stat = await IOUtils.stat(path);
    const metadata = await readPackage(
      crypto,
      password,
      {
        size: stat.size!,
        read: async (offset, maxBytes) =>
          new Uint8Array(await IOUtils.read(path, { offset, maxBytes })),
      },
      async (entry, data) => {
        const target = PathUtils.join(directory, `${files.size}.bin`);
        await IOUtils.write(target, data, { mode: "create" });
        await IOUtils.setPermissions(target, 0o600);
        files.set(fileKey(entry), target);
      },
      signal,
      progress,
    );
    return { manifest: metadata, files, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

export type RowStatus = "add" | "replace" | "same" | "skip" | "path";
export interface PlanRow {
  entry: Entry;
  status: RowStatus;
  selected: boolean;
  mapping: string;
  before: string;
  reason?: string;
}
async function currentState(entry: Entry): Promise<string> {
  if (entry.kind === "credential")
    return JSON.stringify(
      await getAiApiKeyForProvider(entry.provider, entry.origin),
    );
  if (entry.kind === "preference" || entry.kind === "path")
    return JSON.stringify(
      Services.prefs.prefHasUserValue(entry.name)
        ? Zotero.Prefs.get(entry.name, true)
        : null,
    );
  if (entry.kind !== "file") throw new Error("migration-invalid-package");
  if (entry.category === "addons") {
    const current = await addonManager().getAddonByID(entry.addon!.id);
    return current
      ? JSON.stringify({
          version: current.version,
          disabled: Boolean(current.userDisabled),
        })
      : "null";
  }
  const path = await assertSafeDestination(entry);
  return (await IOUtils.exists(path))
    ? await IOUtils.computeHexDigest(path, "sha256")
    : "null";
}
export async function planImport(
  source: Collection,
  signal?: AbortSignal,
): Promise<PlanRow[]> {
  const rows: PlanRow[] = [];
  for (const entry of source.manifest.entries) {
    signal?.throwIfAborted();
    const before = await currentState(entry);
    const row: PlanRow = {
      entry,
      before,
      status: before === "null" || before === '""' ? "add" : "replace",
      selected: true,
      mapping: "",
    };
    if (entry.kind === "path") {
      if (source.manifest.recovery) {
        if (before === JSON.stringify(entry.value)) row.status = "same";
      } else {
        row.status = "path";
        row.selected = false;
      }
    } else if (entry.kind === "preference" || entry.kind === "credential") {
      if (before === JSON.stringify(entry.value)) row.status = "same";
    } else if (entry.kind === "file" && entry.category === "addons") {
      const current = await addonManager().getAddonByID(entry.addon!.id);
      const install = await addonManager()
        .getInstallForFile(
          Zotero.File.pathToFile(source.files.get(fileKey(entry))!),
        )
        .catch(() => undefined);
      if (
        !install ||
        install.error ||
        !install.addon ||
        install.addon.id !== entry.addon!.id ||
        install.addon.version !== entry.addon!.version ||
        !install.addon.isCompatible ||
        !install.addon.isPlatformCompatible ||
        (current && (!eligibleAddon(current) || !addonFile(current)))
      ) {
        row.status = "skip";
        row.reason = "migration-addon-incompatible";
      } else if (
        !source.manifest.recovery &&
        current &&
        Services.vc.compare(current.version, entry.addon!.version) > 0
      ) {
        row.status = "skip";
        row.reason = "migration-addon-newer";
      } else if (
        before ===
        JSON.stringify({
          version: entry.addon!.version,
          disabled: entry.addon!.disabled,
        })
      )
        row.status = "same";
    } else if (entry.kind === "file") {
      if (
        (entry.remove && before === "null") ||
        (!entry.remove &&
          before ===
            (await IOUtils.computeHexDigest(
              source.files.get(fileKey(entry))!,
              "sha256",
            )))
      )
        row.status = "same";
    }
    if (row.status === "same" || row.status === "skip") row.selected = false;
    rows.push(row);
  }
  return rows;
}

export interface ImportResult {
  completed: string[];
  failed: string[];
  recoveryPath: string;
  restart: boolean;
}
export async function applyImport(
  crypto: Crypto,
  source: Collection,
  rows: PlanRow[],
  password: string,
  recoveryPath: string,
  progress: Progress = () => {},
  signal?: AbortSignal,
): Promise<ImportResult> {
  const selected = rows.filter(
    (row) => row.selected && row.status !== "skip" && row.status !== "same",
  );
  const recoveryEntries: Entry[] = [];
  const recoveryFiles = new Map<string, string>();
  for (const row of selected) {
    signal?.throwIfAborted();
    if ((await currentState(row.entry)) !== row.before)
      throw new Error("migration-target-changed");
    const entry = row.entry;
    if (
      entry.kind === "path" &&
      !source.manifest.recovery &&
      (!row.mapping ||
        !PathUtils.isAbsolute(row.mapping) ||
        !(await IOUtils.exists(row.mapping)))
    )
      throw new Error("migration-path-required");
    if (entry.kind === "preference" || entry.kind === "path")
      recoveryEntries.push({
        kind: entry.kind,
        name: entry.name,
        value: JSON.parse(row.before),
      });
    else if (entry.kind === "credential")
      recoveryEntries.push({ ...entry, value: JSON.parse(row.before) });
    else if (entry.kind === "file" && entry.category !== "addons") {
      const path = resourcePath(entry);
      const exists = await IOUtils.exists(path);
      const previous = {
        ...entry,
        size: exists ? (await IOUtils.stat(path)).size! : 0,
        remove: exists ? undefined : true,
      };
      recoveryEntries.push(previous);
      if (exists) recoveryFiles.set(fileKey(previous), path);
    } else if (entry.kind === "file") {
      const current = await addonManager().getAddonByID(entry.addon!.id);
      const path = current && addonFile(current);
      if (path) {
        const previous: FileEntry = {
          ...entry,
          size: (await IOUtils.stat(path)).size!,
          addon: {
            id: current.id,
            version: current.version,
            disabled: Boolean(current.userDisabled),
          },
        };
        recoveryEntries.push(previous);
        recoveryFiles.set(fileKey(previous), path);
      }
    }
  }
  await exportConfiguration(
    crypto,
    { manifest: manifest(recoveryEntries, [], true), files: recoveryFiles },
    password,
    recoveryPath,
    signal,
  );
  // Check again after the recovery snapshot, before the first live change.
  for (const row of selected)
    if ((await currentState(row.entry)) !== row.before)
      throw new Error("migration-target-changed");
  const result: ImportResult = {
    completed: [],
    failed: [],
    recoveryPath,
    restart: false,
  };
  const ordered = [
    ...selected.filter(
      (row) => row.entry.kind !== "file" || row.entry.category !== "addons",
    ),
    ...selected.filter(
      (row) => row.entry.kind === "file" && row.entry.category === "addons",
    ),
  ];
  for (const row of ordered) {
    const entry = row.entry;
    try {
      signal?.throwIfAborted();
      if (entry.kind === "preference" || entry.kind === "path") {
        const value =
          entry.kind === "path" && !source.manifest.recovery
            ? row.mapping
            : entry.value;
        if (value === null) Zotero.Prefs.clear(entry.name, true);
        else Zotero.Prefs.set(entry.name, value, true);
      } else if (entry.kind === "credential")
        await setAiApiKeyForProvider(entry.provider, entry.value, entry.origin);
      else if (entry.kind === "file" && entry.category === "addons") {
        const manager = addonManager();
        const existing = await manager.getAddonByID(entry.addon!.id);
        if (!existing || existing.version !== entry.addon!.version) {
          const install = await manager.getInstallForFile(
            Zotero.File.pathToFile(source.files.get(fileKey(entry))!),
          );
          await new Promise<void>((resolve, reject) => {
            const listener = {
              onInstallEnded: () => {
                install.removeListener(listener);
                resolve();
              },
              onInstallFailed: () => {
                install.removeListener(listener);
                reject(new Error("migration-addon-failed"));
              },
              onInstallCancelled: () => {
                install.removeListener(listener);
                reject(new Error("migration-addon-failed"));
              },
            };
            install.addListener(listener);
            Promise.resolve(install.install()).catch((error) => {
              install.removeListener(listener);
              reject(error);
            });
          });
        }
        const installed = await manager.getAddonByID(entry.addon!.id);
        if (!installed || installed.appDisabled)
          throw new Error("migration-addon-failed");
        if (entry.addon!.disabled) await installed.disable();
        else await installed.enable();
      } else if (entry.kind === "file") {
        const path = await assertSafeDestination(entry);
        if (entry.remove) await IOUtils.remove(path, { ignoreAbsent: true });
        else {
          await IOUtils.makeDirectory(PathUtils.parent(path)!, {
            createAncestors: true,
          });
          await IOUtils.write(
            path,
            await bytes(source.files.get(fileKey(entry))!),
            { tmpPath: `${path}.zotclip-${Zotero.randomString(12)}.tmp` },
          );
        }
      }
      result.completed.push(entryLabel(entry));
      result.restart = true;
    } catch {
      result.failed.push(entryLabel(entry));
      // Do not continue applying configuration after a partial write. Add-ons are independent.
      if (
        signal?.aborted ||
        entry.kind !== "file" ||
        entry.category !== "addons"
      )
        break;
    }
    progress(result.completed.length + result.failed.length, ordered.length);
  }
  return result;
}
