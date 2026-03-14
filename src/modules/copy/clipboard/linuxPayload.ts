export interface LinuxClipboardPayloadData {
  gnomeCopiedFilesText: string;
  uriListText: string;
}

export function buildLinuxClipboardPayload(
  fileUris: string[],
): LinuxClipboardPayloadData {
  return {
    uriListText: `${fileUris.join("\r\n")}\r\n`,
    gnomeCopiedFilesText: `copy\n${fileUris.join("\n")}`,
  };
}

export function buildLinuxClipboardPayloadInput(fileUris: string[]): string {
  const payload = buildLinuxClipboardPayload(fileUris);

  return JSON.stringify({
    uri_payload: payload.uriListText,
    gnome_payload: payload.gnomeCopiedFilesText,
  });
}
