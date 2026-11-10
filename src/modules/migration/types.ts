export const categories = [
  "preferences",
  "credentials",
  "addons",
  "styles",
  "translators",
  "locate",
] as const;
export type Category = (typeof categories)[number];
export type PreferenceValue = string | number | boolean;
export type Entry =
  | { kind: "preference" | "path"; name: string; value: PreferenceValue | null }
  | { kind: "credential"; provider: string; origin: string; value: string }
  | {
      kind: "file";
      category: "addons" | "styles" | "translators" | "locate";
      path: string;
      size: number;
      remove?: boolean;
      addon?: { id: string; version: string; disabled: boolean };
    };
export interface Manifest {
  format: 1;
  createdAt: string;
  source: { zotero: string; zotclip: string; platform: string };
  entries: Entry[];
  omitted: string[];
  recovery: boolean;
}
export type FileEntry = Extract<Entry, { kind: "file" }>;
export type Progress = (completed: number, total: number) => void;
export interface PackageIO {
  read(offset: number, size: number): Promise<Uint8Array<ArrayBuffer>>;
  size: number;
}
export function entryCategory(entry: Entry): Category {
  if (entry.kind === "file") return entry.category;
  return entry.kind === "credential" ? "credentials" : "preferences";
}
export function entryLabel(entry: Entry): string {
  if (entry.kind === "file")
    return entry.addon?.id || `${entry.category}/${entry.path}`;
  if (entry.kind === "credential") return `${entry.provider} · ${entry.origin}`;
  return entry.name;
}
