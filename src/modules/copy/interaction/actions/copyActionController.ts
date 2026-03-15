import type { CopyAvailability } from "../../copyService";
import type { ClipboardResult } from "../../types";
import { buildLibraryRefreshKey } from "../context/libraryContext";
import { buildReaderRefreshKey } from "../readerContext";
import type { CopyActionState } from "./copyActionTypes";

export interface CopyActionControllerDeps {
  getAllowedTypes(): string[];
  getMode(): "all" | "primary";
  getLibraryItems(): Zotero.Item[];
  getReaderItemID(): number | undefined;
  getSelectionAvailability(): Promise<CopyAvailability>;
  getReaderAvailability(): Promise<CopyAvailability>;
  executePrimaryLibraryCopy(): Promise<ClipboardResult>;
  executePrimaryReaderCopy(): Promise<ClipboardResult>;
  executeExplicitReaderPathCopy(): Promise<ClipboardResult>;
}

export function createCopyActionController(deps: CopyActionControllerDeps): {
  getCurrentActionState(): Promise<CopyActionState>;
} {
  return {
    async getCurrentActionState(): Promise<CopyActionState> {
      const allowedTypes = deps.getAllowedTypes();
      const readerItemID = deps.getReaderItemID();

      if (readerItemID) {
        const availability = await deps.getReaderAvailability();
        return {
          source: "reader",
          refreshKey: buildReaderRefreshKey(readerItemID, allowedTypes),
          primary: {
            kind: "copy-files",
            canExecute: availability.canCopy,
            reasonKey: availability.messageKey,
            run: () => deps.executePrimaryReaderCopy(),
          },
          secondary: {
            kind: "copy-path",
            canExecute: availability.canCopy,
            reasonKey: availability.messageKey,
            run: () => deps.executeExplicitReaderPathCopy(),
          },
        };
      }

      const items = deps.getLibraryItems();
      const availability = await deps.getSelectionAvailability();

      return {
        source: "library",
        refreshKey: buildLibraryRefreshKey({
          mode: deps.getMode(),
          allowedTypes,
          items,
        }),
        primary: {
          kind: "copy-files",
          canExecute: availability.canCopy,
          reasonKey: availability.messageKey,
          run: () => deps.executePrimaryLibraryCopy(),
        },
      };
    },
  };
}
