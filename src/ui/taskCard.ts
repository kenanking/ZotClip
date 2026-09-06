import { getAddonFaviconUri } from "../utils/addonAssets";
import { config } from "../../package.json";

type CardSlot = "task" | "notification";
const panels = new Map<Document, Map<CardSlot, TaskCard>>();
const HTML = "http://www.w3.org/1999/xhtml";
// A same-version XPI reinstall can otherwise reuse Gecko's old chrome stylesheet.
const stylesheetURL = `chrome://${config.addonRef}/content/task-card.css?session=${Date.now()}`;

export interface TaskCard {
  readonly running: boolean;
  update(
    text: string,
    itemTitle: string,
    completed: number,
    total: number,
  ): void;
  cancelling(): void;
  finish(
    text: string,
    options?: {
      detail?: string;
      retry?: () => void;
      persistent?: boolean;
      closeTime?: number;
    },
  ): void;
  notice(text: string): void;
  focus(): void;
  dispose(): void;
}
export interface ProgressLabels {
  title: string;
  cancel: string;
  cancelling: string;
  close: string;
  retry: string;
}

export function getTaskCard(
  doc: Document,
  slot: CardSlot = "task",
): TaskCard | undefined {
  return panels.get(doc)?.get(slot);
}

export function disposeTaskCards(): void {
  for (const slots of panels.values()) {
    for (const panel of slots.values()) panel.dispose();
  }
}

export function createTaskCard(
  doc: Document,
  labels: ProgressLabels,
  onCancel: () => void,
  slot: CardSlot = "task",
): TaskCard {
  panels.get(doc)?.get(slot)?.dispose();
  const slots = panels.get(doc) || new Map<CardSlot, TaskCard>();
  const win = doc.defaultView!;
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K) =>
    doc.createElementNS(HTML, tag) as HTMLElementTagNameMap[K];
  const root = element("aside");
  root.id = slot === "task" ? "zotclip-ai-progress" : "zotclip-notification";
  root.className = "zotclip-card";
  root.style.cssText = "box-shadow:none;filter:none";
  root.tabIndex = -1;
  root.dataset.running = "true";
  root.setAttribute("aria-label", labels.title);
  const stylesheet = element("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetURL;
  const header = element("header");
  const title = element("strong");
  title.style.cssText =
    "display:flex;align-items:center;column-gap:8px;min-width:0;line-height:20px";
  const logo = element("img");
  logo.className = "zotclip-card-logo";
  // Constrain the intrinsic 800px SVG before an external stylesheet loads.
  logo.width = 16;
  logo.height = 16;
  logo.style.cssText =
    "display:block;width:16px;height:16px;min-width:16px;min-height:16px;max-width:16px;max-height:16px;object-fit:contain;flex-shrink:0";
  logo.src = getAddonFaviconUri();
  logo.alt = "";
  logo.setAttribute("aria-hidden", "true");
  const titleText = element("span");
  titleText.textContent = labels.title;
  title.append(logo, titleText);
  const action = element("button");
  action.type = "button";
  action.textContent = labels.cancel;
  header.append(title, action);
  const text = element("div");
  text.className = "zotclip-card-status";
  text.setAttribute("role", "status");
  text.setAttribute("aria-atomic", "true");
  const detail = element("div");
  detail.className = "zotclip-card-detail";
  const progress = element("progress");
  progress.setAttribute("aria-label", labels.title);
  const notice = element("div");
  notice.className = "zotclip-card-notice";
  notice.setAttribute("role", "status");
  notice.hidden = true;
  const retry = element("button");
  retry.type = "button";
  retry.textContent = labels.retry;
  retry.hidden = true;
  root.append(stylesheet, header, text, detail, progress, notice, retry);

  let running = true;
  let disposed = false;
  let cancelling = false;
  let timer: number | undefined;
  let autoClose = false;
  let closeTime = 6000;
  let retryAction: (() => void) | undefined;
  const stopTimer = () => {
    if (timer !== undefined) win.clearTimeout(timer);
    timer = undefined;
  };
  const scheduleClose = () => {
    stopTimer();
    if (
      autoClose &&
      !root.matches(":hover") &&
      !root.contains(doc.activeElement)
    )
      timer = win.setTimeout(() => {
        if (!root.matches(":hover") && !root.contains(doc.activeElement))
          panel.dispose();
      }, closeTime);
  };
  const actionClick = () => {
    if (disposed) return;
    if (!running) {
      panel.dispose();
      return;
    }
    if (cancelling) return;
    panel.cancelling();
    onCancel();
  };
  const retryClick = () => {
    if (!retryAction) return;
    const next = retryAction;
    retryAction = undefined;
    panel.dispose();
    next();
  };
  const panel: TaskCard = {
    get running() {
      return running;
    },
    update(message, itemTitle, completed, total) {
      if (disposed || !running || cancelling) return;
      text.textContent = message;
      detail.textContent = itemTitle;
      detail.title = itemTitle;
      detail.hidden = !itemTitle;
      progress.max = total;
      if (total === 1) progress.removeAttribute("value");
      else progress.value = completed;
    },
    cancelling() {
      if (disposed || !running) return;
      cancelling = true;
      text.textContent = labels.cancelling;
      action.textContent = labels.cancelling;
      action.disabled = true;
    },
    finish(message, options = {}) {
      if (disposed) return;
      running = false;
      root.dataset.running = "false";
      text.textContent = message;
      detail.textContent = options.detail || "";
      detail.title = options.detail || "";
      detail.hidden = !options.detail;
      progress.hidden = true;
      action.textContent = labels.close;
      action.disabled = false;
      retryAction = options.retry;
      retry.hidden = !retryAction;
      closeTime = options.closeTime ?? 6000;
      autoClose = !options.persistent && notice.hidden === true;
      scheduleClose();
    },
    notice(message) {
      if (disposed) return;
      notice.textContent = message;
      notice.hidden = false;
      autoClose = false;
      stopTimer();
    },
    focus() {
      if (!disposed) root.focus({ preventScroll: true });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopTimer();
      win.removeEventListener("unload", panel.dispose);
      root.remove();
      if (slots.get(slot) === panel) slots.delete(slot);
      if (!slots.size) {
        panels.delete(doc);
        host?.remove();
      }
      retryAction = undefined;
      if (running) onCancel();
    },
  };
  action.addEventListener("click", actionClick);
  retry.addEventListener("click", retryClick);
  root.addEventListener("mouseenter", stopTimer);
  root.addEventListener("mouseleave", scheduleClose);
  root.addEventListener("focus", stopTimer, true);
  root.addEventListener(
    "blur",
    () => {
      // Wait for Gecko to install the next active element after blur.
      win.setTimeout(() => {
        if (!disposed) scheduleClose();
      }, 0);
    },
    true,
  );
  win.addEventListener("unload", panel.dispose, { once: true });
  let host = doc.getElementById("zotclip-cards");
  if (!host) {
    host = element("section");
    host.id = "zotclip-cards";
    host.setAttribute("style", "box-shadow:none;filter:none");
    doc.documentElement!.appendChild(host);
  }
  slots.set(slot, panel);
  panels.set(doc, slots);
  host.appendChild(root);
  return panel;
}
