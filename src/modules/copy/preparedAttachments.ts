import { mapWithConcurrencyLimit } from "../../utils/concurrency";
import type { ResolvedAttachment } from "./types";

const DUPLICATE_COPY_CONCURRENCY = 4;
let sessionDirectory: Promise<string> | undefined;

/** One namespace per locked Zotero profile and process, retained across plugin reloads. */
export function initializeClipboardSession(): Promise<string> {
  return (sessionDirectory ||= (async () => {
    const root = PathUtils.join(PathUtils.profileDir, "zotclip-clipboard");
    const started = (
      Services.startup.getStartupInfo() as { process: Date }
    ).process.getTime();
    const name = `session-${started}`;
    await IOUtils.makeDirectory(root, { permissions: 0o700 });
    for (const child of await IOUtils.getChildren(root)) {
      if (
        /^session-\d+$/.test(PathUtils.filename(child)) &&
        PathUtils.filename(child) !== name
      ) {
        await IOUtils.remove(child, { recursive: true });
      }
    }
    const current = PathUtils.join(root, name);
    await IOUtils.makeDirectory(current, { permissions: 0o700 });
    return current;
  })());
}

export interface PreparedAttachmentResult {
  files: ResolvedAttachment[];
  tempDir?: string;
}

export interface PreparedAttachmentDeps {
  createOperationTempDir(): Promise<string>;
  copyFile(sourcePath: string, destinationPath: string): Promise<void>;
  getBaseName(path: string): string;
  joinPath(...parts: string[]): string;
  removeTempDir?(path: string): Promise<void>;
}

const DEFAULT_DEPS: PreparedAttachmentDeps = {
  createOperationTempDir: async () =>
    IOUtils.createUniqueDirectory(
      await initializeClipboardSession(),
      "copy",
      0o700,
    ),
  removeTempDir: async (path) => IOUtils.remove(path, { recursive: true }),
  copyFile: async (sourcePath, destinationPath) =>
    IOUtils.copy(sourcePath, destinationPath),
  getBaseName: (path) => PathUtils.filename(path),
  joinPath: (...parts) => PathUtils.join(...parts),
};

export async function prepareResolvedAttachments(
  files: ResolvedAttachment[],
  deps: PreparedAttachmentDeps = DEFAULT_DEPS,
): Promise<PreparedAttachmentResult> {
  const nameCounts = new Map<string, number>();

  for (const file of files) {
    const baseName = deps.getBaseName(file.path).toLowerCase();
    nameCounts.set(baseName, (nameCounts.get(baseName) || 0) + 1);
  }

  const seenCounts = new Map<string, number>();
  const reserved = new Set(nameCounts.keys());
  let operationTempDir: string | undefined;
  const copyJobs: Array<() => Promise<void>> = [];

  const prepared: ResolvedAttachment[] = [];
  for (const file of files) {
    const baseName = deps.getBaseName(file.path);
    const totalCount = nameCounts.get(baseName.toLowerCase()) || 0;
    const seenCount = seenCounts.get(baseName.toLowerCase()) || 0;
    seenCounts.set(baseName.toLowerCase(), seenCount + 1);

    if (totalCount <= 1 || seenCount === 0) {
      prepared.push({
        ...file,
        clipboardPath: file.path,
      });
      continue;
    }

    operationTempDir ||= await deps.createOperationTempDir();
    let suffix = seenCount;
    let name = buildSuffixedName(baseName, suffix);
    while (reserved.has(name.toLowerCase()))
      name = buildSuffixedName(baseName, ++suffix);
    reserved.add(name.toLowerCase());
    const clipboardPath = deps.joinPath(operationTempDir, name);
    copyJobs.push(async () => {
      await deps.copyFile(file.path, clipboardPath);
    });

    prepared.push({
      ...file,
      clipboardPath,
    });
  }

  const failures: unknown[] = [];
  await mapWithConcurrencyLimit(
    copyJobs,
    DUPLICATE_COPY_CONCURRENCY,
    async (job) => {
      try {
        await job();
      } catch (error) {
        failures.push(error);
      }
    },
  );
  if (failures.length) {
    if (operationTempDir) await deps.removeTempDir?.(operationTempDir);
    throw failures[0];
  }
  return { files: prepared, tempDir: operationTempDir };
}

function buildSuffixedName(baseName: string, suffix: number): string {
  const extensionStart = baseName.lastIndexOf(".");
  if (extensionStart <= 0) {
    return `${baseName}_${suffix}`;
  }

  return `${baseName.slice(0, extensionStart)}_${suffix}${baseName.slice(extensionStart)}`;
}
