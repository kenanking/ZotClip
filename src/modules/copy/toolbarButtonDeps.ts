import type { CopyActionState } from "./interaction/actions/copyActionTypes";
import type {
  resolveAttachmentFromReader,
  resolveAttachmentsFromItems,
} from "./attachmentResolver";
import type { copyFromReaderItem, copyFromSelection } from "./copyCommands";
import type {
  registerMainToolbarButton,
  MainToolbarButtonHandle,
} from "./mainToolbarButton";
import type { registerReaderToolbarButton } from "./readerToolbarButton";

export interface MainToolbarCopyButtonDeps {
  isEnabled(): boolean;
  mountButton(
    doc: Document,
    deps: Parameters<typeof registerMainToolbarButton>[1],
  ): MainToolbarButtonHandle;
  getActionState?(): Promise<CopyActionState>;
  getLabel(): string;
  getSelectedItems(win: Window): Zotero.Item[];
  getMode(): "all" | "primary";
  getAllowedTypes(): string[];
  resolveFromItems(
    items: Zotero.Item[],
    mode: "all" | "primary",
    allowedTypes: string[],
  ): Promise<Awaited<ReturnType<typeof resolveAttachmentsFromItems>>>;
  executeCopy(): Promise<Awaited<ReturnType<typeof copyFromSelection>>>;
}

export interface ReaderToolbarCopyButtonDeps {
  isEnabled(): boolean;
  registerButton(
    deps: Parameters<typeof registerReaderToolbarButton>[0],
  ): () => void;
  getActionState?(itemID: number | undefined): Promise<CopyActionState>;
  getLabel(): string;
  getAllowedTypes(): string[];
  resolveFromReader(
    itemID: number,
    allowedTypes: string[],
  ): Promise<Awaited<ReturnType<typeof resolveAttachmentFromReader>>>;
  executeCopy(
    itemID: number | undefined,
  ): Promise<Awaited<ReturnType<typeof copyFromReaderItem>>>;
}
