import { FilePickerHelper } from "zotero-plugin-toolkit";
import type { FluentMessageId } from "../../../typings/i10n";
import { getString } from "../../utils/locale";
import { composeDisposables, createNoopHandle } from "../../utils/disposables";
import {
  applyImport,
  collectConfiguration,
  exportConfiguration,
  inspectPackageEncryption,
  openPackage,
  planImport,
  type OpenPackage,
  type PlanRow,
} from "./service";
import { categories, entryCategory, entryLabel, type Category } from "./types";

const text = (key: string, args?: Record<string, unknown>) =>
  getString(key as FluentMessageId, { args });

export function registerMigrationSection(
  doc: Document,
  onApplied: () => Promise<void>,
): { dispose(): void } {
  const root = doc.getElementById("zotclip-migration");
  if (!root) return createNoopHandle();
  const win = doc.defaultView!;
  const el = <T extends HTMLElement>(id: string) =>
    root.querySelector(`#zotclip-migration-${id}`) as T;
  const create = <K extends keyof HTMLElementTagNameMap>(tag: K) =>
    doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      tag,
    ) as HTMLElementTagNameMap[K];
  const listeners = new AbortController();
  const listen = (target: EventTarget, type: string, listener: EventListener) =>
    target.addEventListener(type, listener, { signal: listeners.signal });
  for (const node of root.querySelectorAll<HTMLElement>("[data-text]"))
    node.textContent = text(node.dataset.text!);
  const password = el<HTMLInputElement>("password");
  const confirm = el<HTMLInputElement>("confirm-password");
  const encrypt = el<HTMLInputElement>("encrypt");
  const importPassword = el<HTMLInputElement>("import-password");
  const status = el("status");
  const progress = el<HTMLProgressElement>("progress");
  progress.setAttribute("aria-label", text("migration-progress"));
  const result = el("result");
  const consent = el<HTMLInputElement>("consent");
  const filter = el<HTMLInputElement>("filter");
  const choices = new Map<Category, HTMLInputElement>();
  el("categories").replaceChildren();
  el("preview").hidden = true;
  status.textContent = result.textContent = "";
  password.value = confirm.value = filter.value = "";
  encrypt.checked = false;
  importPassword.value = "";
  el("unlock").hidden = true;
  consent.checked = false;
  for (const category of categories) {
    const label = create("label");
    label.className = "zotclip-pref-type-option";
    const checkbox = create("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.category = category;
    label.append(
      checkbox,
      doc.createTextNode(text(`migration-category-${category}`)),
    );
    el("categories").append(label);
    choices.set(category, checkbox);
    listen(checkbox, "change", () => {
      for (const row of rows)
        if (entryCategory(row.entry) === category)
          row.selected =
            checkbox.checked && !["same", "skip", "path"].includes(row.status);
      consent.checked = false;
      syncEncryption();
      renderRows();
    });
  }
  let source: OpenPackage | undefined;
  let sourcePassword: string | undefined;
  let pendingPath: string | undefined;
  let rows: PlanRow[] = [];
  let busy = false;
  let applying = false;
  let disposed = false;
  let controller: AbortController | undefined;
  let operation: Promise<void> | undefined;
  let visibleLimit = 100;
  function syncEncryption() {
    el("password-fields").hidden = !encrypt.checked;
    el("plaintext-note").hidden =
      encrypt.checked || !choices.get("credentials")!.checked;
    if (!encrypt.checked) password.value = confirm.value = "";
  }
  function clearPending() {
    pendingPath = undefined;
    importPassword.value = "";
    el("unlock").hidden = true;
    el("import-file").textContent = "";
  }
  function selectedCategories() {
    return new Set(
      [...choices]
        .filter(([, input]) => input.checked)
        .map(([category]) => category),
    );
  }
  function updateSelection() {
    const count = rows.filter(
      (row) => row.selected && choices.get(entryCategory(row.entry))!.checked,
    ).length;
    el("selection").textContent = text("migration-selected", { count });
    el<HTMLButtonElement>("apply").disabled =
      busy || !count || !consent.checked;
  }
  function visibleRows() {
    const query = filter.value.toLowerCase();
    return rows.filter(
      (row) =>
        choices.get(entryCategory(row.entry))!.checked &&
        entryLabel(row.entry).toLowerCase().includes(query),
    );
  }
  function renderRows() {
    const parent = el("rows");
    const filtered = visibleRows();
    const fragment = doc.createDocumentFragment();
    for (const row of filtered.slice(0, visibleLimit)) {
      const entry = row.entry;
      const container = create("div");
      container.className = "zotclip-migration-row";
      const check = create("input");
      check.type = "checkbox";
      check.checked = row.selected;
      check.disabled = busy || row.status === "same" || row.status === "skip";
      check.setAttribute("aria-label", entryLabel(entry));
      check.addEventListener("change", () => {
        row.selected = check.checked;
        consent.checked = false;
        updateSelection();
      });
      const content = create("div");
      const name = create("span");
      name.className = "zotclip-migration-name";
      name.textContent = entryLabel(entry);
      content.append(name);
      const detail = create("div");
      detail.className = "zotclip-pref-help";
      if (entry.kind === "credential")
        detail.textContent = text("migration-key-masked");
      else if (entry.kind === "preference")
        detail.textContent = `${row.before.slice(0, 180)} → ${JSON.stringify(entry.value).slice(0, 180)}`;
      else if (entry.kind === "path")
        detail.textContent = String(entry.value ?? "");
      else if (entry.kind === "file")
        detail.textContent = entry.remove
          ? text("migration-remove-file")
          : `${entry.addon?.version || ""} · ${Math.ceil(entry.size / 1024)} KB`;
      if (row.reason) detail.textContent = text(row.reason);
      content.append(detail);
      if (entry.kind === "path" && !source?.manifest.recovery) {
        const mapping = create("input");
        mapping.className = "zotclip-pref-textinput";
        mapping.type = "text";
        mapping.value = row.mapping;
        mapping.placeholder = text("migration-path-placeholder");
        mapping.setAttribute(
          "aria-label",
          `${text("migration-path-placeholder")} · ${entry.name}`,
        );
        mapping.addEventListener("input", () => {
          row.mapping = mapping.value.trim();
          row.selected = Boolean(row.mapping);
          check.checked = row.selected;
          consent.checked = false;
          updateSelection();
        });
        content.append(mapping);
      }
      const badge = create("span");
      badge.className = "zotclip-pref-help";
      badge.textContent = text(`migration-status-${row.status}`);
      container.append(check, content, badge);
      fragment.append(container);
    }
    parent.replaceChildren(fragment);
    el("more").hidden = filtered.length <= visibleLimit;
    updateSelection();
  }
  function setBusy(value: boolean) {
    busy = value;
    for (const input of root!.querySelectorAll<
      HTMLInputElement | HTMLButtonElement
    >("input, button"))
      input.disabled = value;
    el<HTMLButtonElement>("cancel").disabled = !value || applying;
    el("cancel").hidden = !value;
    progress.hidden = !value;
    if (value) {
      progress.removeAttribute("value");
      updateSelection();
    } else renderRows();
  }
  const onProgress = (completed: number, total: number) => {
    if (disposed) return;
    progress.max = total || 1;
    progress.value = completed;
  };
  async function discardSource() {
    await source?.dispose();
    source = undefined;
    sourcePassword = undefined;
    rows = [];
    el("rows").replaceChildren();
    el("preview").hidden = true;
    consent.checked = false;
  }
  function run(task: () => Promise<void>) {
    if (busy || disposed) return;
    controller = new AbortController();
    status.dataset.error = "false";
    result.textContent = "";
    setBusy(true);
    operation = task()
      .catch((error) => {
        if (disposed) return;
        status.dataset.error = "true";
        const code =
          error instanceof Error && /^migration-[a-z-]+$/.test(error.message)
            ? error.message
            : controller?.signal.aborted
              ? "migration-cancelled"
              : "migration-failed";
        status.textContent = text(code);
      })
      .finally(() => {
        if (!disposed) {
          setBusy(false);
          if (pendingPath) importPassword.focus();
        }
        applying = false;
      });
  }
  async function choose(
    mode: "save" | "open",
    title: string,
    suggestion?: string,
  ) {
    const path = await new FilePickerHelper(
      text(title),
      mode,
      [["ZotClip", "*.zotclip"]],
      suggestion,
      win,
    ).open();
    return typeof path === "string" ? path : undefined;
  }
  listen(el("export"), "click", () =>
    run(async () => {
      if (encrypt.checked && password.value.length < 10)
        throw new Error("migration-password-short");
      if (encrypt.checked && password.value !== confirm.value)
        throw new Error("migration-password-mismatch");
      if (!selectedCategories().size)
        throw new Error("migration-select-content");
      const destination = await choose(
        "save",
        "migration-export",
        `ZotClip-${new Date().toISOString().replace(/[:.]/g, "-")}.zotclip`,
      );
      if (!destination) return;
      clearPending();
      await discardSource();
      status.textContent = text("migration-collecting");
      const collection = await collectConfiguration(
        selectedCategories(),
        controller!.signal,
      );
      status.textContent = text(
        encrypt.checked ? "migration-encrypting" : "migration-exporting",
      );
      await exportConfiguration(
        win.crypto,
        collection,
        encrypt.checked ? password.value : undefined,
        destination,
        controller!.signal,
        onProgress,
      );
      status.textContent = text("migration-exported");
      result.textContent = `${destination}\n${text("migration-export-count", { count: collection.manifest.entries.length })}${collection.manifest.omitted.length ? `\n${text("migration-omitted")}\n${collection.manifest.omitted.join("\n")}` : ""}`;
      password.value = confirm.value = "";
    }),
  );
  listen(el("import"), "click", () =>
    run(async () => {
      const path = await choose("open", "migration-import");
      if (!path) return;
      clearPending();
      await discardSource();
      if (await inspectPackageEncryption(path)) {
        pendingPath = path;
        el("import-file").textContent = PathUtils.filename(path);
        el("unlock").hidden = false;
        status.textContent = text("migration-password-required");
      } else {
        await previewPackage(path, undefined);
      }
    }),
  );
  listen(el("unlock-preview"), "click", () =>
    run(async () => {
      if (!importPassword.value) throw new Error("migration-password-required");
      await previewPackage(pendingPath!, importPassword.value);
    }),
  );
  listen(el("unlock-cancel"), "click", () => {
    clearPending();
    status.textContent = "";
  });
  async function previewPackage(path: string, key: string | undefined) {
    await discardSource();
    status.textContent = text(
      key === undefined ? "migration-checking" : "migration-decrypting",
    );
    source = await openPackage(
      win.crypto,
      path,
      key,
      controller!.signal,
      onProgress,
    );
    sourcePassword = source.encrypted ? key : undefined;
    clearPending();
    status.textContent = text("migration-planning");
    rows = await planImport(source, controller!.signal);
    for (const row of rows)
      row.selected &&= choices.get(entryCategory(row.entry))!.checked;
    el("source").textContent =
      `Zotero ${source.manifest.source.zotero} · ${source.manifest.source.platform} · ${new Date(source.manifest.createdAt).toLocaleString()}`;
    if (source.manifest.recovery)
      el("source").textContent += ` · ${text("migration-recovery")}`;
    el("source").textContent +=
      ` · ${text(source.encrypted ? "migration-encrypted" : "migration-unencrypted")}`;
    el("recovery-mode").textContent = text(
      source.encrypted
        ? "migration-recovery-encrypted"
        : "migration-recovery-unencrypted",
    );
    el("preview").hidden = false;
    visibleLimit = 100;
    status.textContent = text("migration-preview-ready");
    if (source.manifest.omitted.length)
      result.textContent = `${text("migration-omitted")}\n${source.manifest.omitted.join("\n")}`;
  }
  listen(el("apply"), "click", () =>
    run(async () => {
      if (!source || !consent.checked) return;
      const recoveryPath = await choose(
        "save",
        "migration-save-recovery",
        `ZotClip-recovery-${Date.now()}.zotclip`,
      );
      if (!recoveryPath) return;
      applying = true;
      el<HTMLButtonElement>("cancel").disabled = true;
      status.textContent = text("migration-applying");
      const plugin = addon;
      plugin.hooks.onMigrationStart();
      try {
        const outcome = await applyImport(
          win.crypto,
          source,
          rows,
          sourcePassword,
          recoveryPath,
          onProgress,
          controller!.signal,
        );
        status.textContent = text(
          outcome.failed.length ? "migration-partial" : "migration-imported",
        );
        status.dataset.error = String(Boolean(outcome.failed.length));
        result.textContent = [
          text("migration-completed", { count: outcome.completed.length }),
          text("migration-recovery-saved", { path: recoveryPath }),
          ...(outcome.failed.length
            ? [text("migration-failed-items"), ...outcome.failed]
            : []),
          ...(outcome.restart ? [text("migration-restart")] : []),
        ].join("\n");
        await discardSource();
      } finally {
        plugin.hooks.onMigrationEnd();
        if (!disposed) await onApplied();
      }
    }),
  );
  listen(consent, "change", updateSelection);
  listen(filter, "input", () => {
    visibleLimit = 100;
    renderRows();
  });
  listen(el("more"), "click", () => {
    visibleLimit += 100;
    renderRows();
  });
  for (const [id, selected] of [
    ["select-visible", true],
    ["clear-visible", false],
  ] as const) {
    listen(el(id), "click", () => {
      for (const row of visibleRows())
        if (!["same", "skip", "path"].includes(row.status))
          row.selected = selected;
      consent.checked = false;
      renderRows();
    });
  }
  listen(el("cancel"), "click", () => controller?.abort());
  listen(encrypt, "change", syncEncryption);
  listen(win, "beforeunload", (event) => {
    if (applying) event.preventDefault();
  });
  syncEncryption();
  setBusy(false);
  return composeDisposables(() => {
    disposed = true;
    listeners.abort();
    controller?.abort();
    password.value = confirm.value = "";
    sourcePassword = undefined;
    clearPending();
    void (operation ?? Promise.resolve()).finally(discardSource);
  });
}
