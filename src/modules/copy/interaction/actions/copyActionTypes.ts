import type { ClipboardSource } from "../../clipboard/types";
import type { ClipboardResult, CopyMessageKey } from "../../types";

export interface CopyPrimaryAction {
  kind: "copy-files";
  canExecute: boolean;
  reasonKey?: CopyMessageKey;
  run(): Promise<ClipboardResult>;
}

export interface CopySecondaryAction {
  kind: "copy-path";
  canExecute: boolean;
  reasonKey?: CopyMessageKey;
  run(): Promise<ClipboardResult>;
}

export interface CopyActionState {
  source: ClipboardSource;
  refreshKey: string;
  primary: CopyPrimaryAction;
  secondary?: CopySecondaryAction;
}
