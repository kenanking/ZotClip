import type { ResolvedAttachment } from "../types";
import type { ClipboardPayload, ClipboardSource } from "./types";

export function buildClipboardPayload(
  files: ResolvedAttachment[],
  source: ClipboardSource,
): ClipboardPayload {
  const paths = Array.from(
    new Set(
      files
        .map((file) => (file.clipboardPath || file.path)?.trim())
        .filter(Boolean),
    ),
  ) as string[];

  return {
    paths,
    fileUris: paths.map((path) => pathToFileUri(path)),
    pathText: paths.join("\n"),
    operation: "copy",
    source,
  };
}

function pathToFileUri(path: string): string {
  if (/^[A-Za-z]:\\/.test(path)) {
    const normalizedPath = path.replace(/\\/g, "/");
    return `file:///${encodeURI(normalizedPath)}`;
  }

  return `file://${encodeURI(path)}`;
}
