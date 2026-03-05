import type { MultiPDFMode, ResolvedPDF } from "./types";

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
  const results: ResolvedPDF[] = [];

  for (const item of items) {
    const candidates = await resolveCandidateAttachments(item, mode, deps);
    for (const attachment of candidates) {
      if (!attachment.isPDFAttachment()) {
        continue;
      }

      const path = await attachment.getFilePathAsync();
      if (!path || typeof path !== "string") {
        continue;
      }

      results.push({
        itemID: item.isAttachment() ? item.parentID || item.id : item.id,
        attachmentID: attachment.id,
        path,
      });
    }
  }

  return dedupeByPath(results);
}

export async function resolvePDFFromReader(
  itemID: number,
  deps: AttachmentResolverDeps = DEFAULT_DEPS,
): Promise<ResolvedPDF[]> {
  const item = deps.getItemByID?.(itemID);
  if (!item || !item.isAttachment() || !item.isPDFAttachment()) {
    return [];
  }

  const path = await item.getFilePathAsync();
  if (!path || typeof path !== "string") {
    return [];
  }

  return [
    {
      itemID: item.parentID || item.id,
      attachmentID: item.id,
      path,
    },
  ];
}

async function resolveCandidateAttachments(
  item: Zotero.Item,
  mode: MultiPDFMode,
  deps: AttachmentResolverDeps,
): Promise<Zotero.Item[]> {
  if (item.isAttachment()) {
    return item.isPDFAttachment() ? [item] : [];
  }

  if (mode === "primary") {
    const bestMany = await item.getBestAttachments();
    if (bestMany?.length) {
      return bestMany;
    }

    const bestOne = await item.getBestAttachment();
    return bestOne ? [bestOne] : [];
  }

  const childIDs = item.getAttachments(true);
  if (!childIDs.length) {
    return [];
  }

  return deps.getItemsByIDs(childIDs);
}

function dedupeByPath(input: ResolvedPDF[]): ResolvedPDF[] {
  const seen = new Set<string>();
  return input.filter((result) => {
    if (seen.has(result.path)) {
      return false;
    }

    seen.add(result.path);
    return true;
  });
}
