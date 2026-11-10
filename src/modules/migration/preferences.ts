import { openMigrationWindow } from "./ui";

export function registerMigrationSection(doc: Document): { dispose(): void } {
  const button = doc.getElementById("zotclip-open-migration");
  button?.addEventListener("click", openMigrationWindow);
  return {
    dispose: () => button?.removeEventListener("click", openMigrationWindow),
  };
}
