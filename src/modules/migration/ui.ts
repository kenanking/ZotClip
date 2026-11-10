import { FilePickerHelper } from "zotero-plugin-toolkit";
import { config } from "../../../package.json";
import type { FluentMessageId } from "../../../typings/i10n";
import { getString } from "../../utils/locale";
import {
  applyImport,
  collectConfiguration,
  exportConfiguration,
  openPackage,
  planImport,
  type OpenPackage,
  type PlanRow,
} from "./service";
import { categories, entryCategory, entryLabel, type Category } from "./types";

let migrationWindow: Window | undefined;
let closeMigration: (() => void) | undefined;
const text = (key: string, args?: Record<string, unknown>) =>
  getString(key as FluentMessageId, { args });

export function openMigrationWindow(): void {
  if (migrationWindow && !migrationWindow.closed) {
    migrationWindow.focus();
    return;
  }
  migrationWindow =
    Zotero.getMainWindow().openDialog(
      `chrome://${config.addonRef}/content/migration.xhtml`,
      "zotclip-migration",
      "chrome,centerscreen,resizable,width=860,height=760",
      { mount: mountMigrationWindow },
    ) || undefined;
}
export function disposeMigrationUI(): void {
  closeMigration?.();
}

export function mountMigrationWindow(win: Window): void {
  const doc = win.document;
  const el = <T extends HTMLElement>(id: string) => doc.getElementById(id) as T;
  doc.title = text("migration-title");
  for (const node of doc.querySelectorAll<HTMLElement>("[data-text]"))
    node.textContent = text(node.dataset.text!);
  const password = el<HTMLInputElement>("password");
  const confirm = el<HTMLInputElement>("confirm-password");
  const status = el<HTMLParagraphElement>("status");
  const progress = el<HTMLProgressElement>("progress");
  progress.setAttribute("aria-label", text("migration-progress"));
  const result = el<HTMLPreElement>("result");
  const consent = el<HTMLInputElement>("consent");
  const filter = el<HTMLInputElement>("filter");
  const choices = new Map<Category, HTMLInputElement>();
  for (const category of categories) {
    const label = doc.createElement("label");
    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.category = category;
    label.append(
      checkbox,
      doc.createTextNode(text(`migration-category-${category}`)),
    );
    el("categories").append(label);
    choices.set(category, checkbox);
    checkbox.addEventListener("change", () => {
      for (const row of rows)
        if (entryCategory(row.entry) === category)
          row.selected =
            checkbox.checked && !["same", "skip", "path"].includes(row.status);
      consent.checked = false;
      renderRows();
    });
  }
  let source: OpenPackage | undefined;
  let sourcePassword = "";
  let rows: PlanRow[] = [];
  let busy = false;
  let applying = false;
  let disposed = false;
  let controller: AbortController | undefined;
  let operation: Promise<void> | undefined;
  let visibleLimit = 100;
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
    parent.replaceChildren();
    const filtered = visibleRows();
    const fragment = doc.createDocumentFragment();
    for (const row of filtered.slice(0, visibleLimit)) {
      const entry = row.entry;
      const container = doc.createElement("div");
      container.className = "row";
      const check = doc.createElement("input");
      check.type = "checkbox";
      check.checked = row.selected;
      check.disabled = busy || row.status === "same" || row.status === "skip";
      check.setAttribute("aria-label", entryLabel(entry));
      check.addEventListener("change", () => {
        row.selected = check.checked;
        consent.checked = false;
        updateSelection();
      });
      const content = doc.createElement("div");
      const name = doc.createElement("strong");
      name.textContent = entryLabel(entry);
      content.append(name);
      const detail = doc.createElement("small");
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
        const mapping = doc.createElement("input");
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
      const badge = doc.createElement("span");
      badge.className = "badge";
      badge.textContent = text(`migration-status-${row.status}`);
      container.append(check, content, badge);
      fragment.append(container);
    }
    parent.append(fragment);
    el("more").hidden = filtered.length <= visibleLimit;
    updateSelection();
  }
  function setBusy(value: boolean) {
    busy = value;
    for (const input of doc.querySelectorAll<
      HTMLInputElement | HTMLButtonElement
    >("input, button"))
      input.disabled = value;
    el<HTMLButtonElement>("cancel").disabled = !value || applying;
    el("cancel").hidden = !value;
    progress.hidden = !value;
    if (value) progress.removeAttribute("value");
    else renderRows();
    updateSelection();
  }
  const onProgress = (completed: number, total: number) => {
    if (disposed) return;
    progress.max = total || 1;
    progress.value = completed;
  };
  async function discardSource() {
    await source?.dispose();
    source = undefined;
    sourcePassword = "";
    rows = [];
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
      .finally(async () => {
        if (disposed) await source?.dispose();
        else setBusy(false);
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
  el("export").addEventListener("click", () =>
    run(async () => {
      if (password.value.length < 10)
        throw new Error("migration-password-short");
      if (password.value !== confirm.value)
        throw new Error("migration-password-mismatch");
      if (!selectedCategories().size)
        throw new Error("migration-select-content");
      const destination = await choose(
        "save",
        "migration-export",
        `ZotClip-${new Date().toISOString().replace(/[:.]/g, "-")}.zotclip`,
      );
      if (!destination) return;
      await discardSource();
      status.textContent = text("migration-collecting");
      const collection = await collectConfiguration(
        selectedCategories(),
        controller!.signal,
      );
      status.textContent = text("migration-encrypting");
      await exportConfiguration(
        win.crypto,
        collection,
        password.value,
        destination,
        controller!.signal,
        onProgress,
      );
      status.textContent = text("migration-exported");
      result.textContent = `${destination}\n${text("migration-export-count", { count: collection.manifest.entries.length })}${collection.manifest.omitted.length ? `\n${text("migration-omitted")}\n${collection.manifest.omitted.join("\n")}` : ""}`;
      password.value = confirm.value = "";
    }),
  );
  el("import").addEventListener("click", () =>
    run(async () => {
      if (!password.value) throw new Error("migration-password-required");
      const path = await choose("open", "migration-import");
      if (!path) return;
      await discardSource();
      status.textContent = text("migration-decrypting");
      source = await openPackage(
        win.crypto,
        path,
        password.value,
        controller!.signal,
        onProgress,
      );
      sourcePassword = password.value;
      password.value = confirm.value = "";
      status.textContent = text("migration-planning");
      rows = await planImport(source, controller!.signal);
      for (const row of rows)
        row.selected &&= choices.get(entryCategory(row.entry))!.checked;
      el("source").textContent =
        `Zotero ${source.manifest.source.zotero} · ${source.manifest.source.platform} · ${new Date(source.manifest.createdAt).toLocaleString()}`;
      if (source.manifest.recovery)
        el("source").textContent += ` · ${text("migration-recovery")}`;
      el("preview").hidden = false;
      visibleLimit = 100;
      renderRows();
      status.textContent = text("migration-preview-ready");
      if (source.manifest.omitted.length)
        result.textContent = `${text("migration-omitted")}\n${source.manifest.omitted.join("\n")}`;
    }),
  );
  el("apply").addEventListener("click", () =>
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
      }
    }),
  );
  consent.addEventListener("change", updateSelection);
  filter.addEventListener("input", () => {
    visibleLimit = 100;
    renderRows();
  });
  el("more").addEventListener("click", () => {
    visibleLimit += 100;
    renderRows();
  });
  for (const [id, selected] of [
    ["select-visible", true],
    ["clear-visible", false],
  ] as const) {
    el(id).addEventListener("click", () => {
      for (const row of visibleRows())
        if (!["same", "skip", "path"].includes(row.status))
          row.selected = selected;
      consent.checked = false;
      renderRows();
    });
  }
  el("cancel").addEventListener("click", () => controller?.abort());
  el("close").addEventListener("click", () => win.close());
  win.addEventListener("beforeunload", (event) => {
    if (applying) event.preventDefault();
  });
  win.addEventListener(
    "unload",
    () => {
      disposed = true;
      controller?.abort();
      password.value = confirm.value = sourcePassword = "";
      void (operation ?? Promise.resolve()).finally(() => source?.dispose());
      migrationWindow = undefined;
      closeMigration = undefined;
    },
    { once: true },
  );
  closeMigration = () => {
    controller?.abort();
    applying = false;
    win.close();
  };
}
