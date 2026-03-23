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
    return `file:///${encodePathSegments(path.replace(/\\/g, "/"))}`;
  }

  return `file://${encodePathSegments(path)}`;
}

function encodePathSegments(posixPath: string): string {
  return posixPath
    .split("/")
    .map((seg) => (/^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)))
    .join("/");
}
