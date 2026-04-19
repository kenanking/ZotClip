import { mapWithConcurrencyLimit } from "../../utils/concurrency";
import type { ResolvedAttachment } from "./types";

const DUPLICATE_COPY_CONCURRENCY = 4;
const TEMP_DIR_CLEANUP_DELAY_MS = 30_000;

export interface PreparedAttachmentResult {
  files: ResolvedAttachment[];
  tempDir?: string;
}

export interface PreparedAttachmentDeps {
  createOperationTempDir(): Promise<string>;
  copyFile(sourcePath: string, destinationPath: string): Promise<void>;
  getBaseName(path: string): string;
  joinPath(...parts: string[]): string;
}

const DEFAULT_DEPS: PreparedAttachmentDeps = {
  createOperationTempDir: async () =>
    IOUtils.createUniqueDirectory(PathUtils.tempDir, "zotclip-copy-"),
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
    const baseName = deps.getBaseName(file.path);
    nameCounts.set(baseName, (nameCounts.get(baseName) || 0) + 1);
  }

  const seenCounts = new Map<string, number>();
  let operationTempDir: string | undefined;
  const copyJobs: Array<() => Promise<void>> = [];

  const prepared: ResolvedAttachment[] = [];
  for (const file of files) {
    const baseName = deps.getBaseName(file.path);
    const totalCount = nameCounts.get(baseName) || 0;
    const seenCount = seenCounts.get(baseName) || 0;
    seenCounts.set(baseName, seenCount + 1);

    if (totalCount <= 1 || seenCount === 0) {
      prepared.push({
        ...file,
        clipboardPath: file.path,
      });
      continue;
    }

    operationTempDir ||= await deps.createOperationTempDir();
    const clipboardPath = deps.joinPath(
      operationTempDir,
      buildSuffixedName(baseName, seenCount),
    );
    copyJobs.push(async () => {
      await deps.copyFile(file.path, clipboardPath);
    });

    prepared.push({
      ...file,
      clipboardPath,
    });
  }

  await mapWithConcurrencyLimit(
    copyJobs,
    DUPLICATE_COPY_CONCURRENCY,
    async (job) => job(),
  );
  return { files: prepared, tempDir: operationTempDir };
}

export function scheduleTempDirCleanup(
  tempDir: string,
  delayMs: number = TEMP_DIR_CLEANUP_DELAY_MS,
  removeFn: (path: string) => Promise<void> = defaultRemoveTempDir,
): void {
  setTimeout(() => {
    void removeFn(tempDir).catch((error) => {
      ztoolkit.log("[ZotClip] Failed to clean up temp dir:", tempDir, error);
    });
  }, delayMs);
}

async function defaultRemoveTempDir(path: string): Promise<void> {
  await IOUtils.remove(path, { recursive: true });
}

function buildSuffixedName(baseName: string, suffix: number): string {
  const extensionStart = baseName.lastIndexOf(".");
  if (extensionStart <= 0) {
    return `${baseName}_${suffix}`;
  }

  return `${baseName.slice(0, extensionStart)}_${suffix}${baseName.slice(extensionStart)}`;
}
