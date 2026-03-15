import {
  extractExtensionFromPath,
  normalizeExtensionList,
} from "./attachmentTypes";
import type { MultiAttachmentMode, ResolvedAttachment } from "./types";

const ITEM_RESOLUTION_CONCURRENCY = 4;
const ATTACHMENT_PATH_CONCURRENCY = 8;

export interface AttachmentResolverDeps {
  getItemsByIDs(ids: number[]): Zotero.Item[];
  getItemByID?(id: number): Zotero.Item | false | undefined;
}

const DEFAULT_DEPS: AttachmentResolverDeps = {
  getItemsByIDs: (ids) => Zotero.Items.get(ids),
  getItemByID: (id) => Zotero.Items.get(id),
};

export async function resolveAttachmentsFromItems(
  items: Zotero.Item[],
  mode: MultiAttachmentMode,
  allowedTypes: string[],
  deps: AttachmentResolverDeps = DEFAULT_DEPS,
): Promise<ResolvedAttachment[]> {
  const allowedSet = buildAllowedTypeSet(allowedTypes);
  if (!allowedSet.size) {
    return [];
  }

  const results = await mapWithConcurrencyLimit(
    items,
    ITEM_RESOLUTION_CONCURRENCY,
    async (item) => resolveCandidateAttachments(item, mode, allowedSet, deps),
  );

  return dedupeByPath(results.flat());
}

export async function resolveAttachmentFromReader(
  itemID: number,
  allowedTypes: string[],
  deps: AttachmentResolverDeps = DEFAULT_DEPS,
): Promise<ResolvedAttachment[]> {
  const allowedSet = buildAllowedTypeSet(allowedTypes);
  if (!allowedSet.size) {
    return [];
  }

  const item = deps.getItemByID?.(itemID);
  if (!item || !item.isAttachment()) {
    return [];
  }

  return resolveAllowedAttachments(
    [item],
    item.parentID || item.id,
    allowedSet,
  );
}

async function resolveCandidateAttachments(
  item: Zotero.Item,
  mode: MultiAttachmentMode,
  allowedSet: Set<string>,
  deps: AttachmentResolverDeps,
): Promise<ResolvedAttachment[]> {
  if (item.isAttachment()) {
    return resolveAllowedAttachments(
      [item],
      item.parentID || item.id,
      allowedSet,
    );
  }

  if (mode === "primary") {
    const bestMany = await item.getBestAttachments();
    const bestCandidates = bestMany?.length
      ? bestMany
      : await resolveBestAttachmentCandidate(item);
    const bestResolved = await resolveAllowedAttachments(
      bestCandidates,
      item.id,
      allowedSet,
    );
    if (bestResolved.length) {
      return [bestResolved[0]];
    }
  }

  const childIDs = item.getAttachments(true);
  if (!childIDs.length) {
    return [];
  }

  const resolvedChildren = await resolveAllowedAttachments(
    deps.getItemsByIDs(childIDs),
    item.id,
    allowedSet,
  );

  return mode === "primary" ? resolvedChildren.slice(0, 1) : resolvedChildren;
}

async function resolveAllowedAttachments(
  attachments: Zotero.Item[],
  itemID: number,
  allowedSet: Set<string>,
): Promise<ResolvedAttachment[]> {
  const results = await mapWithConcurrencyLimit(
    attachments,
    ATTACHMENT_PATH_CONCURRENCY,
    async (attachment) => {
      if (!attachment?.isAttachment?.()) {
        return undefined;
      }

      const path = await attachment.getFilePathAsync();
      if (!path || typeof path !== "string") {
        return undefined;
      }

      const extension = extractExtensionFromPath(path);
      if (!extension || !allowedSet.has(extension)) {
        return undefined;
      }

      return {
        itemID,
        attachmentID: attachment.id,
        path,
      };
    },
  );

  return results.filter((result): result is ResolvedAttachment => !!result);
}

async function resolveBestAttachmentCandidate(
  item: Zotero.Item,
): Promise<Zotero.Item[]> {
  const bestOne = await item.getBestAttachment();
  return bestOne ? [bestOne] : [];
}

function buildAllowedTypeSet(allowedTypes: string[]): Set<string> {
  return new Set(normalizeExtensionList(allowedTypes));
}

function dedupeByPath(input: ResolvedAttachment[]): ResolvedAttachment[] {
  const seen = new Set<string>();
  return input.filter((result) => {
    if (seen.has(result.path)) {
      return false;
    }

    seen.add(result.path);
    return true;
  });
}

async function mapWithConcurrencyLimit<Input, Output>(
  input: Input[],
  concurrency: number,
  map: (value: Input, index: number) => Promise<Output>,
): Promise<Output[]> {
  if (!input.length) {
    return [];
  }

  const results = new Array<Output>(input.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, input.length) },
    async () => {
      while (nextIndex < input.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await map(input[currentIndex], currentIndex);
      }
    },
  );

  await Promise.all(workers);
  return results;
}
