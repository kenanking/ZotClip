interface AiPromptPlaceholders {
  title: string;
  abstract: string;
  language: string;
}

/**
 * Resolves a Zotero locale id to a human-readable language label for the AI
 * prompt. Prefer Zotero's built-in native names ({@link Zotero.Locale.availableLocales})
 * so every shipped UI locale works without maintaining our own map.
 */
export function resolveAiPromptLanguageLabel(
  locale: string,
  nativeNames: Readonly<Record<string, string>>,
): string {
  const key = locale.replace(/_/g, "-");
  const native = nativeNames[key];
  if (native) {
    return native;
  }
  const primary = key.split("-")[0];
  if (primary) {
    try {
      const label = new Intl.DisplayNames(["en"], { type: "language" }).of(
        primary,
      );
      if (label) {
        return label;
      }
    } catch {
      // Intl missing in exotic runtimes
    }
  }
  return key;
}

export function getAiPromptLanguageLabel(): string {
  const nativeNames = Zotero.Locale.availableLocales as unknown as Record<
    string,
    string
  >;
  return resolveAiPromptLanguageLabel(Zotero.locale as string, nativeNames);
}

export function fillAiPromptTemplate(
  template: string,
  vars: AiPromptPlaceholders,
): string {
  // Single-pass replace so a placeholder-like substring inside one value
  // (e.g. a title that literally contains "{abstract}") is not re-substituted
  // by a later pass.
  const values: Record<string, string> = {
    title: vars.title,
    abstract: vars.abstract,
    language: vars.language,
  };
  return template.replace(
    /\{(title|abstract|language)\}/g,
    (match, key: "title" | "abstract" | "language") => values[key],
  );
}
