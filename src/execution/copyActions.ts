import {
  copyFromReaderItem,
  copyFromSelection,
} from "../modules/copy/copyCommands";
import { copyFromReaderPath } from "../modules/copy/copyPathCommands";
import { notifyCopyResult } from "../modules/copy/notifier";
import type {
  ClipboardResult,
  MultiAttachmentMode,
} from "../modules/copy/types";

export interface CopyActionSettings {
  multiAttachmentMode: MultiAttachmentMode;
  allowedTypes: string[];
}

export async function executeCopyFromSelection(
  settings: CopyActionSettings,
): Promise<ClipboardResult> {
  const result = await copyFromSelection(
    settings.multiAttachmentMode,
    settings.allowedTypes,
  );
  notifyCopyResult(result);
  return result;
}

export async function executeCopyFromReaderItem(
  itemID: number | undefined,
  settings: Pick<CopyActionSettings, "allowedTypes">,
): Promise<ClipboardResult> {
  const result = await copyFromReaderItem(itemID, settings.allowedTypes);
  notifyCopyResult(result);
  return result;
}

export async function executeCopyPathFromReader(
  settings: Pick<CopyActionSettings, "allowedTypes">,
): Promise<ClipboardResult> {
  const result = await copyFromReaderPath(settings.allowedTypes);
  notifyCopyResult(result);
  return result;
}
