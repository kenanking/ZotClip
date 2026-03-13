export interface ParsedShortcut {
  ctrlOrMeta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

export function parseShortcut(
  value: string | undefined,
): ParsedShortcut | undefined {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return undefined;
  }

  let ctrlOrMeta = false;
  let alt = false;
  let shift = false;
  let key = "";

  for (const rawToken of normalizedValue.split("+")) {
    const token = rawToken.trim().toLowerCase();
    if (!token) {
      continue;
    }

    if (token === "ctrl" || token === "control" || token === "cmd") {
      ctrlOrMeta = true;
      continue;
    }

    if (token === "meta") {
      ctrlOrMeta = true;
      continue;
    }

    if (token === "alt" || token === "option") {
      alt = true;
      continue;
    }

    if (token === "shift") {
      shift = true;
      continue;
    }

    key = token;
  }

  if (!key) {
    return undefined;
  }

  return {
    ctrlOrMeta,
    alt,
    shift,
    key,
  };
}

export function matchesShortcut(
  shortcut: ParsedShortcut | undefined,
  event: KeyboardEvent,
): boolean {
  if (!shortcut) {
    return false;
  }

  const eventKey = event.key.toLowerCase();
  const hasCtrlOrMeta = event.ctrlKey || event.metaKey;

  return (
    shortcut.key === eventKey &&
    shortcut.ctrlOrMeta === hasCtrlOrMeta &&
    shortcut.alt === event.altKey &&
    shortcut.shift === event.shiftKey
  );
}

export function formatShortcut(shortcut: ParsedShortcut | undefined): string {
  if (!shortcut) {
    return "";
  }

  const parts: string[] = [];
  if (shortcut.ctrlOrMeta) {
    parts.push("Ctrl");
  }
  if (shortcut.alt) {
    parts.push("Alt");
  }
  if (shortcut.shift) {
    parts.push("Shift");
  }
  parts.push(formatKey(shortcut.key));

  return parts.join("+");
}

function formatKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}
