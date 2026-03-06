import {
  extractExtensionFromPath,
  normalizeExtensionList,
} from "./attachmentTypes";
import type {
  MultiAttachmentMode,
  MultiPDFMode,
  ResolvedAttachment,
  ResolvedPDF,
} from "./types";

export interface AttachmentResolverDeps {
  getItemsByIDs(ids: number[]): Zotero.Item[];
  getItemByID?(id: number): Zotero.Item | false | undefined;
}

const DEFAULT_DEPS: AttachmentResolverDeps = {
  getItemsByIDs: (ids) => Zotero.Items.get(ids),
  getItemByID: (id) => Zotero.Items.get(id),
};

export async function resolvePDFsFromItems(
  items: Zotero.Item[],
  mode: MultiPDFMode,
  deps: AttachmentResolverDeps = DEFAULT_DEPS,
): Promise<ResolvedPDF[]> {
  return resolveAttachmentsFromItems(items, mode, ["pdf"], deps);
}

export async function resolvePDFFromReader(
  itemID: number,
  deps: AttachmentResolverDeps = DEFAULT_DEPS,
): Promise<ResolvedPDF[]> {
  return resolveAttachmentFromReader(itemID, ["pdf"], deps);
}

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

  const results: ResolvedAttachment[] = [];

  for (const item of items) {
    const candidates = await resolveCandidateAttachments(
      item,
      mode,
      allowedSet,
      deps,
    );
    results.push(...candidates);
  }

  return dedupeByPath(results);
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

  return resolveAllowedAttachments([item], item.parentID || item.id, allowedSet);
}

async function resolveCandidateAttachments(
  item: Zotero.Item,
  mode: MultiAttachmentMode,
  allowedSet: Set<string>,
  deps: AttachmentResolverDeps,
): Promise<ResolvedAttachment[]> {
  if (item.isAttachment()) {
    return resolveAllowedAttachments([item], item.parentID || item.id, allowedSet);
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
  const results: ResolvedAttachment[] = [];

  for (const attachment of attachments) {
    if (!attachment?.isAttachment?.()) {
      continue;
    }

    const path = await attachment.getFilePathAsync();
    if (!path || typeof path !== "string") {
      continue;
    }

    const extension = extractExtensionFromPath(path);
    if (!extension || !allowedSet.has(extension)) {
      continue;
    }

    results.push({
      itemID,
      attachmentID: attachment.id,
      path,
    });
  }

  return results;
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
