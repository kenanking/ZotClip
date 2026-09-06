import type { FluentMessageId } from "../../../../typings/i10n";

export type ApiKeyFieldState = "loading" | "saved" | "unset" | "error";

/** Render presence only; never put credentials or masking characters into value. */
export function renderApiKeyField(
  input: HTMLInputElement,
  status: HTMLElement | null,
  deleteButton: HTMLButtonElement | null,
  state: ApiKeyFieldState,
  translate: (key: FluentMessageId) => string,
  optionalPlaceholder?: string,
): void {
  const keys = {
    loading: "pref-key-loading",
    saved: "pref-key-saved",
    unset: "pref-key-unset",
    error: "pref-key-unavailable",
  } as const;
  input.placeholder =
    state === "unset" && optionalPlaceholder
      ? optionalPlaceholder
      : translate(keys[state]);
  input.title = input.placeholder;
  if (status) {
    status.hidden = state !== "error";
    status.textContent = state === "error" ? translate("pref-key-error") : "";
  }
  if (deleteButton) deleteButton.disabled = state !== "saved";
}
