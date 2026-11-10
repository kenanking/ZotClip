import type { Manifest, PreferenceValue } from "./types";

export const MAX_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
export const MAX_ENTRIES = 20000;
const ownPrefix = "extensions.zotero.zotclip.";
const blocked =
  /(?:password|secret|token|api.?key|credential|sync|firstRun|lastApp|lastVersion|prefVersion|recentSaveTargets|lastViewedFolder|thirdPartyCache|httpServer|debug|scaffold|testXpi|testVersion|migration)/i;
const protectedNames = new Set([
  "extensions.zotero.dataDir",
  "extensions.zotero.useDataDir",
]);

export function portablePreference(name: string): boolean {
  return (
    name.startsWith("extensions.") &&
    name.slice("extensions.".length).includes(".") &&
    name.length <= 512 &&
    !blocked.test(name) &&
    !protectedNames.has(name) &&
    !/^extensions\.(?:blocklist|checkCompatibility|webextensions|update|zotero(?:WinWord|MacWord|OpenOffice)Integration)\./i.test(
      name,
    ) &&
    !/^extensions\.zotero\.(?:purge|certRevocations)\./.test(name) &&
    !/(?:^|\.)(?:installed|version|buildID|itemID|libraryID|collectionID)$/i.test(
      name,
    ) &&
    !Array.from(name).some((character) => character.charCodeAt(0) < 32)
  );
}
export function isOwnPreference(name: string): boolean {
  return name.startsWith(ownPrefix);
}
export function isMachinePath(name: string, value: unknown): boolean {
  return (
    typeof value === "string" &&
    (/^(?:[a-z]:[\\/]|\\\\|\/|file:\/\/)/i.test(value) ||
      /(?:dir|directory|path|folder)$/i.test(name))
  );
}
export function validPreferenceValue(value: unknown): value is PreferenceValue {
  return (
    typeof value === "boolean" ||
    (typeof value === "string" && value.length <= 262144) ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= -2147483648 &&
      value <= 2147483647)
  );
}
export function validRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 1024 &&
    path
      .split("/")
      .every(
        (part) =>
          part.length > 0 &&
          part !== "." &&
          part !== ".." &&
          !/[\\:<>"|?*]/.test(part) &&
          !Array.from(part).some((character) => character.charCodeAt(0) < 32) &&
          !/[. ]$/.test(part) &&
          !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  );
}
export function validCredential(provider: string, origin: string): boolean {
  if (
    !["deepseek", "openrouter", "ollama", "lmstudio", "custom"].includes(
      provider,
    )
  )
    return false;
  try {
    const url = new URL(origin);
    return ["http:", "https:"].includes(url.protocol) && url.origin === origin;
  } catch {
    return false;
  }
}

export function validateManifest(value: unknown): asserts value is Manifest {
  const m = value as Manifest;
  if (
    !m ||
    m.format !== 1 ||
    typeof m.recovery !== "boolean" ||
    typeof m.createdAt !== "string" ||
    !Number.isFinite(Date.parse(m.createdAt)) ||
    !m.source ||
    ![m.source.zotero, m.source.zotclip, m.source.platform].every(
      (v) => typeof v === "string" && v.length < 128,
    ) ||
    !Array.isArray(m.entries) ||
    m.entries.length > MAX_ENTRIES ||
    !Array.isArray(m.omitted) ||
    m.omitted.length > MAX_ENTRIES ||
    !m.omitted.every((v) => typeof v === "string" && v.length <= 1024)
  )
    throw new Error("migration-invalid-package");
  const identities = new Set<string>();
  let total = 0;
  for (const e of m.entries) {
    if (!e || typeof e !== "object")
      throw new Error("migration-invalid-package");
    let identity: string;
    if (e.kind === "preference" || e.kind === "path") {
      if (
        typeof e.name !== "string" ||
        !portablePreference(e.name) ||
        !(validPreferenceValue(e.value) || (m.recovery && e.value === null)) ||
        (e.kind === "preference" && isMachinePath(e.name, e.value))
      )
        throw new Error("migration-invalid-package");
      identity = `preference:${e.name}`;
    } else if (e.kind === "credential") {
      if (
        !validCredential(e.provider, e.origin) ||
        typeof e.value !== "string" ||
        e.value.length > 65536
      )
        throw new Error("migration-invalid-package");
      identity = `credential:${e.provider}|${e.origin}`;
    } else if (e.kind === "file") {
      if (
        !["addons", "styles", "translators", "locate"].includes(e.category) ||
        typeof e.path !== "string" ||
        !validRelativePath(e.path) ||
        !Number.isSafeInteger(e.size) ||
        e.size < 0 ||
        e.size > MAX_FILE_BYTES ||
        (e.remove !== undefined &&
          (e.remove !== true ||
            !m.recovery ||
            e.size !== 0 ||
            e.category === "addons"))
      )
        throw new Error("migration-invalid-package");
      if (e.category === "addons") {
        const a = e.addon;
        if (
          !a ||
          typeof a.id !== "string" ||
          !/^[a-z0-9@{}._+-]+$/i.test(a.id) ||
          typeof a.version !== "string" ||
          !a.version ||
          a.version.length > 128 ||
          typeof a.disabled !== "boolean" ||
          a.id === "zotclip@cvrsg.dev" ||
          /^Zotero(?:WinWord|MacWord|OpenOffice)Integration@/i.test(a.id) ||
          e.path !== `${a.id}.xpi`
        )
          throw new Error("migration-invalid-package");
      } else if (e.addon) throw new Error("migration-invalid-package");
      total += e.size;
      identity = `file:${e.category}/${e.path.toLowerCase()}`;
    } else throw new Error("migration-invalid-package");
    if (identities.has(identity)) throw new Error("migration-invalid-package");
    identities.add(identity);
  }
  if (total > MAX_PACKAGE_BYTES) throw new Error("migration-too-large");
}
