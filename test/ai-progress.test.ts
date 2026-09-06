import { registerAutoTagItemAddObserver } from "../src/modules/tagging/integration/itemAddAutoTagObserver";
import { config } from "../package.json";
import {
  createTaskCard,
  disposeTaskCards,
  getTaskCard,
} from "../src/ui/taskCard";
import { executeAutoTagSelection } from "../src/modules/tagging/integration/manualAutoTagSelection";

const labels = {
  title: "ZotClip · AI tags",
  cancel: "Cancel",
  cancelling: "Cancelling…",
  close: "Close",
  retry: "Retry failed items",
};

describe("AI task feedback", function () {
  afterEach(function () {
    disposeTaskCards();
  });

  it("keeps progress, cancellation and results in one card", function () {
    const doc = Zotero.getMainWindow().document;
    let cancelled = 0;
    const panel = createTaskCard(doc, labels, () => {
      cancelled++;
    });
    panel.update("Processing 1 / 3", "Synthetic article title", 0, 3);
    const card = doc.getElementById("zotclip-ai-progress")!;
    assert.equal(doc.querySelectorAll("#zotclip-ai-progress").length, 1);
    const cancel = card.querySelector("button") as HTMLButtonElement;
    cancel.click();
    cancel.click();
    assert.equal(cancelled, 1);
    assert.equal(cancel.disabled, true);
    assert.equal(
      card.querySelector('[role="status"]')!.textContent,
      labels.cancelling,
    );
    panel.finish("Cancelled; completed tags kept", { persistent: true });
    assert.equal(
      (card.querySelector("progress") as HTMLProgressElement).hidden,
      true,
    );
    assert.equal(cancel.textContent, "Close");
    assert.equal(cancel.disabled, false);
    cancel.click();
    assert.equal(getTaskCard(doc), undefined);
    assert.equal(cancelled, 1);
  });

  it("retries once and folds background failures into the same card", function () {
    const doc = Zotero.getMainWindow().document;
    const panel = createTaskCard(doc, labels, () => {});
    panel.update("Processing", "Item", 0, 1);
    assert.equal(
      doc.querySelector("#zotclip-ai-progress progress")!.hasAttribute("value"),
      false,
    );
    panel.notice("Automatic tagging failed for 2 items");
    let retries = 0;
    panel.finish("One failed", {
      persistent: true,
      retry: () => {
        retries++;
      },
    });
    const card = doc.getElementById("zotclip-ai-progress")!;
    assert.equal(
      card.querySelector(".zotclip-card-notice")!.textContent,
      "Automatic tagging failed for 2 items",
    );
    const retry = card.querySelector(":scope > button") as HTMLButtonElement;
    retry.click();
    retry.click();
    assert.equal(retries, 1);
    assert.equal(getTaskCard(doc), undefined);
  });

  it("dismisses successful results after six seconds", async function () {
    this.timeout(10000);
    const doc = Zotero.getMainWindow().document;
    const panel = createTaskCard(doc, labels, () => {});
    panel.finish("Done: 1 tagged");
    await Zotero.Promise.delay(6200);
    assert.equal(getTaskCard(doc), undefined);
  });

  it("cancels and removes active feedback when disposed", function () {
    const doc = Zotero.getMainWindow().document;
    let cancelled = 0;
    createTaskCard(doc, labels, () => {
      cancelled++;
    });
    disposeTaskCards();
    disposeTaskCards();
    assert.equal(cancelled, 1);
    assert.equal(doc.getElementById("zotclip-ai-progress"), null);
  });

  it("manual commands share a task, cancel safely and retry only failed items", async function () {
    this.timeout(20000);
    const win = Zotero.getMainWindow();
    const pane = win.ZoteroPane;
    const savedSelection = pane.getSelectedItems;
    const savedHttp = Zotero.HTTP.request;
    const pref = `${config.prefsPrefix}.aiProvider`;
    const savedProvider = Zotero.Prefs.get(pref, true);
    const enabledPref = `${config.prefsPrefix}.autoTaggingEnabled`;
    const savedEnabled = Zotero.Prefs.get(enabledPref, true);
    const savedAddon = (window as any).addon;
    const savedToolkit = (window as any).ztoolkit;
    (window as any).addon = Zotero[config.addonInstance];
    (window as any).ztoolkit = {
      ProgressWindow: class {
        constructor() {
          throw new Error("Duplicate floating progress popup");
        }
      },
    };
    const item = new Zotero.Item("journalArticle");
    item.setField("title", "A study of radar image interpretation");
    await item.saveTx();
    let release!: (value: any) => void;
    let calls = 0;
    let operation: Promise<void> | undefined;
    let secondItem: Zotero.Item | undefined;
    try {
      Zotero.Prefs.set(pref, "ollama", true);
      Zotero.Prefs.set(enabledPref, true, true);
      pane.getSelectedItems = () => [item];
      Zotero.HTTP.request = (() => {
        calls++;
        return new Promise((resolve) => {
          release = resolve;
        });
      }) as typeof savedHttp;
      operation = executeAutoTagSelection();
      for (let n = 0; n < 100 && !calls; n++) await Zotero.Promise.delay(20);
      assert.equal(calls, 1);
      await executeAutoTagSelection();
      assert.equal(calls, 1);
      const card = win.document.getElementById("zotclip-ai-progress")!;
      assert.ok(card);
      assert.equal(
        win.document.querySelectorAll("#zotclip-ai-progress").length,
        1,
      );
      await Zotero.Promise.delay(100);
      assert.equal(
        win.getComputedStyle(win.document.getElementById("zotclip-cards")!)
          .position,
        "fixed",
      );
      // Privileged canvas capture, if available, records the real Zotero window.
      const canvas = win.document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "canvas",
      ) as HTMLCanvasElement;
      canvas.width = win.innerWidth;
      canvas.height = win.innerHeight;
      const context = canvas.getContext("2d") as any;
      if (typeof context?.drawWindow === "function") {
        context.drawWindow(win, 0, 0, win.innerWidth, win.innerHeight, "white");
        const bytes = Uint8Array.from(
          atob(canvas.toDataURL().split(",")[1]),
          (c) => c.charCodeAt(0),
        );
        const directory = PathUtils.join(
          PathUtils.parent(PathUtils.parent(PathUtils.profileDir)),
          "validation",
        );
        await IOUtils.makeDirectory(directory, { createAncestors: true });
        await IOUtils.write(
          PathUtils.join(directory, `ai-progress-${Zotero.locale}.png`),
          bytes,
        );
      }
      (card.querySelector("button") as HTMLButtonElement).click();
      release({
        status: 200,
        responseText: JSON.stringify({
          choices: [{ message: { content: '{"tags":["must not be saved"]}' } }],
        }),
      });
      await operation;
      assert.equal(item.hasTag("must not be saved"), false);
      assert.equal(getTaskCard(win.document)?.running, false);
      secondItem = new Zotero.Item("journalArticle");
      secondItem.setField("title", "Only this failed item should be retried");
      await secondItem.saveTx({ skipSelect: true });
      pane.getSelectedItems = () => [item, secondItem!];
      calls = 0;
      Zotero.HTTP.request = (async () => {
        calls++;
        return {
          status: 200,
          responseText:
            calls === 2
              ? "invalid fixture response"
              : JSON.stringify({
                  choices: [
                    { message: { content: '{"tags":["manual retry test"]}' } },
                  ],
                }),
        };
      }) as typeof savedHttp;
      await executeAutoTagSelection();
      assert.equal(calls, 2);
      const retry = win.document.querySelector(
        "#zotclip-ai-progress > button",
      ) as HTMLButtonElement;
      assert.equal(retry.hidden, false);
      retry.click();
      for (
        let attempt = 0;
        attempt < 300 && getTaskCard(win.document)?.running;
        attempt++
      )
        await Zotero.Promise.delay(20);
      assert.equal(
        calls,
        3,
        "The successful item must not be requested a second time",
      );
      assert.ok(item.hasTag("manual retry test"));
      assert.ok(secondItem.hasTag("manual retry test"));
      Zotero.Prefs.set(enabledPref, false, true);
      await executeAutoTagSelection();
      assert.equal(calls, 3, "Disabled AI tagging must not start requests");
      assert.equal(getTaskCard(win.document)?.running, false);
    } finally {
      release?.({ status: 200, responseText: "{}" });
      await operation;
      pane.getSelectedItems = savedSelection;
      Zotero.HTTP.request = savedHttp;
      Zotero.Prefs.set(pref, savedProvider, true);
      Zotero.Prefs.set(enabledPref, savedEnabled, true);
      (window as any).addon = savedAddon;
      (window as any).ztoolkit = savedToolkit;
      await item.eraseTx();
      await secondItem?.eraseTx();
    }
  });

  it("keeps automatic successes quiet and reports failures once per batch", async function () {
    this.timeout(15000);
    const doc = Zotero.getMainWindow().document;
    const savedAddon = (window as any).addon;
    (window as any).addon = Zotero[config.addonInstance];
    const prefs = ["aiProvider", "autoTaggingEnabled", "autoTagOnAdd"].map(
      (name) => `${config.prefsPrefix}.${name}`,
    );
    const previous = prefs.map((name) => Zotero.Prefs.get(name, true));
    const savedRequest = Zotero.HTTP.request;
    const savedRegister = Zotero.Notifier.registerObserver;
    const items: Zotero.Item[] = [];
    let observer: any;
    let handle: { dispose(): void } | undefined;
    let calls = 0;
    try {
      Zotero.Prefs.set(prefs[1], false, true);
      for (let i = 0; i < 3; i++) {
        const item = new Zotero.Item("journalArticle");
        item.setField("title", `Synthetic background item ${i}`);
        await item.saveTx({ skipSelect: true });
        items.push(item);
      }
      await Zotero.Promise.delay(600);
      Zotero.Prefs.set(prefs[0], "ollama", true);
      Zotero.Prefs.set(prefs[1], true, true);
      Zotero.Prefs.set(prefs[2], true, true);
      Zotero.HTTP.request = (async () => {
        calls++;
        if (calls <= 2) throw new Error("Synthetic request failure");
        return {
          status: 200,
          responseText: JSON.stringify({
            choices: [{ message: { content: '{"tags":["background test"]}' } }],
          }),
        };
      }) as typeof savedRequest;
      Zotero.Notifier.registerObserver = ((...args: any[]) => {
        observer = args[0];
        return (savedRegister as any).apply(Zotero.Notifier, args);
      }) as typeof savedRegister;
      handle = registerAutoTagItemAddObserver();
      Zotero.Notifier.registerObserver = savedRegister;
      observer.notify(
        "add",
        "item",
        items.map((item) => item.id),
        {},
      );
      for (let i = 0; i < 300 && !getTaskCard(doc); i++)
        await Zotero.Promise.delay(20);
      assert.equal(calls, 3);
      assert.ok(items[2].hasTag("background test"));
      assert.equal(doc.querySelectorAll("#zotclip-ai-progress").length, 1);
      const message = doc.querySelector(
        "#zotclip-ai-progress .zotclip-card-status",
      )!.textContent;
      assert.ok(
        message?.includes("2"),
        message || "Missing batch failure summary",
      );
      assert.equal(getTaskCard(doc)?.running, false);
    } finally {
      handle?.dispose();
      Zotero.Notifier.registerObserver = savedRegister;
      Zotero.HTTP.request = savedRequest;
      prefs.forEach((name, index) =>
        Zotero.Prefs.set(name, previous[index], true),
      );
      (window as any).addon = savedAddon;
      for (const item of items) await item.eraseTx();
    }
  });
});
