import { config } from "../package.json";
import {
  showNotification,
  showMainWindowNotification,
} from "../src/ui/notification";
import {
  createTaskCard,
  disposeTaskCards,
  getTaskCard,
} from "../src/ui/taskCard";
import { notifyCopyResult } from "../src/modules/copy/notifier";

const labels = {
  title: "ZotClip · AI 标签",
  cancel: "取消",
  cancelling: "正在取消…",
  close: "关闭",
  retry: "重试",
};

describe("Shared notification cards", function () {
  let savedAddon: unknown;

  before(function () {
    savedAddon = (window as any).addon;
    (window as any).addon = Zotero[config.addonInstance];
  });

  after(function () {
    (window as any).addon = savedAddon;
  });

  afterEach(function () {
    disposeTaskCards();
  });

  it("stacks copy notifications with a running task without cancelling it", async function () {
    const win = Zotero.getMainWindow();
    const doc = win.document;
    let cancelled = 0;
    const task = createTaskCard(doc, labels, () => {
      cancelled++;
    });
    task.update(
      "正在处理第 1 / 3 个条目…",
      "A study of radar image interpretation",
      0,
      3,
    );
    notifyCopyResult({
      outcome: "copied-files",
      count: 1,
      ok: true,
      format: "file-object",
    });
    const notification = doc.getElementById("zotclip-notification")!;
    assert.ok(notification);
    assert.equal(task.running, true);
    assert.equal(cancelled, 0);
    await Zotero.Promise.delay(150);
    const taskElement = doc.getElementById("zotclip-ai-progress")!;
    assert.equal(taskElement.className, notification.className);
    assert.isAtMost(
      taskElement.getBoundingClientRect().bottom,
      notification.getBoundingClientRect().top,
    );
    assert.equal(
      win.getComputedStyle(taskElement).borderRadius,
      win.getComputedStyle(notification).borderRadius,
    );
    for (const element of [taskElement, notification]) {
      assert.equal(win.getComputedStyle(element).boxShadow, "none");
      const logo = element.querySelector("img") as HTMLImageElement;
      assert.ok(logo.complete && logo.naturalWidth > 0, "Plugin logo loaded");
      assert.equal(logo.alt, "");
      assert.equal(logo.getAttribute("width"), "16");
      assert.equal(logo.getAttribute("height"), "16");
      assert.equal(logo.getBoundingClientRect().width, 16);
      assert.equal(logo.getBoundingClientRect().height, 16);
      const titleText = element.querySelector("strong span")!;
      const iconRect = logo.getBoundingClientRect();
      const textRect = titleText.getBoundingClientRect();
      assert.closeTo(textRect.left - iconRect.right, 8, 0.5);
      assert.closeTo(
        (textRect.top + textRect.bottom) / 2,
        (iconRect.top + iconRect.bottom) / 2,
        0.5,
      );
      const stylesheet = element.querySelector("link") as HTMLLinkElement;
      assert.include(stylesheet.href, "?session=");
      // Reproduce old chrome CSS remaining in the window after an XPI update.
      const staleStyle = doc.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "style",
      );
      staleStyle.textContent =
        ".zotclip-card { box-shadow: 0 4px 16px black; } .zotclip-card header strong { display: inline; column-gap: 0; }";
      element.appendChild(staleStyle);
      const sheet = stylesheet.sheet!;
      sheet.disabled = true;
      try {
        assert.equal(win.getComputedStyle(element).boxShadow, "none");
        assert.equal(win.getComputedStyle(logo.parentElement!).display, "flex");
        assert.equal(
          win.getComputedStyle(logo.parentElement!).columnGap,
          "8px",
        );
        assert.equal(logo.getBoundingClientRect().width, 16);
        assert.equal(logo.getBoundingClientRect().height, 16);
      } finally {
        sheet.disabled = false;
        staleStyle.remove();
      }
    }
    const canvas = doc.createElementNS(
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
      const dir = PathUtils.join(
        PathUtils.parent(PathUtils.parent(PathUtils.profileDir)),
        "validation",
      );
      await IOUtils.makeDirectory(dir, { createAncestors: true });
      await IOUtils.write(
        PathUtils.join(dir, `notification-cards-${Zotero.locale}.png`),
        bytes,
      );
    }
    showMainWindowNotification("连接成功");
    assert.equal(doc.querySelectorAll(".zotclip-card").length, 2);
    assert.include(
      doc.getElementById("zotclip-notification")!.textContent,
      "连接成功",
    );
    (
      doc.querySelector("#zotclip-notification button") as HTMLButtonElement
    ).click();
    assert.equal(getTaskCard(doc, "notification"), undefined);
    assert.equal(getTaskCard(doc), task);
    assert.equal(cancelled, 0);
  });

  it("pauses dismissal during keyboard interaction and removes an empty host", async function () {
    const doc = Zotero.getMainWindow().document;
    doc.defaultView!.focus();
    await Zotero.Promise.delay(50);
    showNotification("Clipboard updated", 100, doc);
    const card = doc.getElementById("zotclip-notification")!;
    (doc.defaultView as any).windowUtils.sendMouseEvent(
      "mousemove",
      1,
      1,
      0,
      0,
      0,
    );
    (card.querySelector("button") as HTMLButtonElement).focus();
    await Zotero.Promise.delay(180);
    assert.ok(getTaskCard(doc, "notification"));
    (card.querySelector("button") as HTMLButtonElement).blur();
    await Zotero.Promise.delay(250);
    assert.equal(
      card.contains(doc.activeElement),
      false,
      `Focus remains on ${doc.activeElement?.tagName}`,
    );
    assert.equal(
      card.matches(":hover"),
      false,
      "Pointer is still over the card",
    );
    assert.equal(getTaskCard(doc, "notification"), undefined);
    assert.equal(doc.getElementById("zotclip-cards"), null);
  });
});
