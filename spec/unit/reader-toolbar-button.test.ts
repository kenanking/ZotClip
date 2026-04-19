import assert from "node:assert/strict";
import test from "node:test";

import { initToolbarIcon } from "../../src/modules/copy/copyUi";
import {
  mountReaderToolbarButton,
  registerReaderToolbarButton,
  type ReaderToolbarRenderEventLike,
} from "../../src/modules/copy/readerToolbarButton";
import { createReaderActionState } from "./fixtures/actionStateFixtures";

type EventHandler = (event: Event) => void;

class FakeButton {
  id = "";
  className = "";
  title = "";
  textContent = "";
  disabled = false;
  style = "";
  private attributes = new Map<string, string>();
  private listeners = new Map<string, EventHandler[]>();

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "style") {
      this.style = value;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: EventHandler): void {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventHandler): void {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      listeners.filter((item) => item !== listener),
    );
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) || []) {
      listener({ currentTarget: this } as Event);
    }
  }

  remove(): void {
    return;
  }
}

class FakeDocument {
  readonly appended: FakeButton[] = [];
  private elements = new Map<string, FakeButton | FakeContainer>();

  createElement(tagName: string): FakeButton {
    assert.equal(tagName, "button");
    return new FakeButton();
  }

  getElementById(id: string): FakeButton | FakeContainer | null {
    return this.elements.get(id) || null;
  }

  register(node: FakeButton): void {
    this.appended.push(node);
    this.elements.set(node.id, node);
  }

  get button(): FakeButton {
    const node = this.elements.get("zotclip-reader-copy-button");
    assert.ok(node);
    return node;
  }
}

class FakeContainer {
  id = "";
  className = "";
  readonly appended: Array<FakeButton | FakeContainer> = [];

  append(...nodes: Array<FakeButton | FakeContainer>): void {
    this.appended.push(...nodes);
  }
}

class ExistingReaderDocument extends FakeDocument {
  readonly customSections = new FakeContainer();
  readonly existingSection = new FakeContainer();
  private sections = new Map<string, FakeContainer>();

  constructor() {
    super();
    this.customSections.className = "custom-sections";
    this.existingSection.className = "section";
    const originalAppend = this.customSections.append.bind(this.customSections);
    this.customSections.append = (...nodes) => {
      originalAppend(...nodes);
      for (const node of nodes) {
        if (node instanceof FakeContainer && node.id) {
          this.sections.set(node.id, node);
        }
      }
    };
    this.customSections.append(this.existingSection);
  }

  override createElement(tagName: string): FakeButton | FakeContainer {
    if (tagName === "button") {
      return super.createElement(tagName);
    }

    assert.equal(tagName, "div");
    return new FakeContainer();
  }

  override getElementById(id: string): FakeButton | FakeContainer | null {
    return super.getElementById(id) || this.sections.get(id) || null;
  }

  querySelector(selector: string): FakeContainer | null {
    switch (selector) {
      case ".custom-sections":
        return this.customSections;
      case ".custom-sections > .section":
        return this.existingSection;
      default:
        return null;
    }
  }
}

function makeEvent(
  doc: FakeDocument,
  itemID = 1001,
): ReaderToolbarRenderEventLike {
  return {
    reader: {
      itemID,
    },
    doc: doc as unknown as Document,
    append: (...nodes) => {
      for (const node of nodes) {
        if (typeof node !== "string") {
          doc.register(node as unknown as FakeButton);
        }
      }
    },
  };
}

async function primeToolbarIcon(): Promise<void> {
  await initToolbarIcon({
    readIcon: async () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"></svg>`,
  });
}

test("mountReaderToolbarButton appends an icon-only button through renderToolbar", async () => {
  await primeToolbarIcon();
  const doc = new FakeDocument();
  const handle = mountReaderToolbarButton(makeEvent(doc), {
    getLabel: () => "Copy Current Reader Attachment",
    getActionState: async () => createReaderActionState(),
  });

  await handle.refresh();

  assert.equal(doc.appended.length, 1);
  assert.match(doc.button.className, /zotclip-reader-toolbar-button/);
  assert.match(doc.button.style, /data:image\/svg\+xml/);
  assert.equal(doc.button.textContent, "");
  assert.equal(doc.button.title, "Copy Current Reader Attachment");
  assert.equal(doc.button.disabled, false);
});

test("mountReaderToolbarButton keeps the button visible but disabled when reader copy is unavailable", async () => {
  await primeToolbarIcon();
  const doc = new FakeDocument();
  const handle = mountReaderToolbarButton(makeEvent(doc), {
    getLabel: () => "Copy Current Reader Attachment",
    getActionState: async () =>
      createReaderActionState({
        canExecute: false,
        reasonKey: "copy-reader-no-active",
      }),
    getActionTooltipText: () => "No eligible reader attachment.",
  });

  await handle.refresh();

  assert.equal(doc.button.disabled, true);
  assert.equal(doc.button.title, "No eligible reader attachment.");
});

test("mountReaderToolbarButton click uses the current reader item id", async () => {
  await primeToolbarIcon();
  const doc = new FakeDocument();
  let clickedItemID: number | undefined;
  const handle = mountReaderToolbarButton(makeEvent(doc, 2048), {
    getLabel: () => "Copy Current Reader Attachment",
    getActionState: async (itemID) =>
      createReaderActionState({
        run: async () => {
          clickedItemID = itemID;
          return {
            ok: true,
            format: "file-object",
            count: 1,
            outcome: "copied-files",
          };
        },
      }),
  });

  await handle.refresh();
  doc.button.dispatch("click");

  assert.equal(clickedItemID, 2048);
});

test("mountReaderToolbarButton does not append duplicates for the same reader document", async () => {
  await primeToolbarIcon();
  const doc = new FakeDocument();
  const firstHandle = mountReaderToolbarButton(makeEvent(doc), {
    getLabel: () => "Copy Current Reader Attachment",
    getActionState: async () => createReaderActionState(),
  });
  const secondHandle = mountReaderToolbarButton(makeEvent(doc), {
    getLabel: () => "Copy Current Reader Attachment",
    getActionState: async () => createReaderActionState(),
  });

  await firstHandle.refresh();
  await secondHandle.refresh();

  assert.equal(doc.appended.length, 1);
});

test("mountReaderToolbarButton coalesces repeated refresh calls for the same reader item", async () => {
  await primeToolbarIcon();
  const doc = new FakeDocument();
  let actionStateCalls = 0;

  const handle = mountReaderToolbarButton(makeEvent(doc, 2048), {
    getLabel: () => "Copy Current Reader Attachment",
    getRefreshKey: (itemID) => `reader:${itemID || "none"}`,
    getActionState: async () => {
      actionStateCalls += 1;
      return createReaderActionState();
    },
  });

  await Promise.all([handle.refresh(), handle.refresh()]);

  assert.equal(actionStateCalls, 1);
});

test("mountReaderToolbarButton runs the copy command only once for a single toolbar activation", async () => {
  await primeToolbarIcon();
  const doc = new FakeDocument();
  let calls = 0;

  const handle = mountReaderToolbarButton(makeEvent(doc, 2048), {
    getLabel: () => "Copy Current Reader Attachment",
    getActionState: async () =>
      createReaderActionState({
        run: async () => {
          calls += 1;
          return {
            ok: true,
            format: "file-object",
            count: 1,
            outcome: "copied-files",
          };
        },
      }),
  });

  await handle.refresh();
  doc.button.dispatch("command");
  doc.button.dispatch("click");

  assert.equal(calls, 1);
});

test("registerReaderToolbarButton creates a dedicated fallback section for existing readers", async () => {
  await primeToolbarIcon();
  const doc = new ExistingReaderDocument();
  let registerHandler:
    | ((event: ReaderToolbarRenderEventLike) => void)
    | undefined;

  const dispose = registerReaderToolbarButton({
    getLabel: () => "Copy Current Reader Attachment",
    getActionState: async () => createReaderActionState(),
    readerAPI: {
      registerEventListener: (_type, handler) => {
        registerHandler = handler;
      },
      unregisterEventListener: () => {},
      _readers: [
        {
          itemID: 1001,
          _iframeWindow: {
            document: doc as unknown as Document,
          } as unknown as Window,
        },
      ],
    },
  });

  assert.ok(registerHandler, "Expected renderToolbar registration.");
  assert.equal(doc.existingSection.appended.length, 0);
  assert.equal(doc.customSections.appended.length, 2);
  assert.equal(
    (doc.customSections.appended[1] as FakeContainer).className,
    "section",
  );
  assert.equal(
    (
      (doc.customSections.appended[1] as FakeContainer)
        .appended[0] as FakeButton
    ).id,
    "zotclip-reader-copy-button",
  );

  dispose();
});

test("registerReaderToolbarButton reuses reader availability for repeated render events", async () => {
  await primeToolbarIcon();
  const doc = new FakeDocument();
  let actionStateCalls = 0;
  let registerHandler:
    | ((event: ReaderToolbarRenderEventLike) => void)
    | undefined;

  const dispose = registerReaderToolbarButton({
    getLabel: () => "Copy Current Reader Attachment",
    getRefreshKey: (itemID) => `reader:${itemID || "none"}`,
    getActionState: async () => {
      actionStateCalls += 1;
      return createReaderActionState();
    },
    readerAPI: {
      registerEventListener: (_type, handler) => {
        registerHandler = handler;
      },
      unregisterEventListener: () => {},
      _readers: [],
    },
  });

  assert.ok(registerHandler, "Expected renderToolbar registration.");
  registerHandler!(makeEvent(doc, 2048));
  registerHandler!(makeEvent(doc, 2048));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(actionStateCalls, 1);
  dispose();
});

test("mountReaderToolbarButton uses a shared helper to build the button node", async () => {
  await primeToolbarIcon();
  const doc = new FakeDocument();
  let helperCalls = 0;

  const handle = mountReaderToolbarButton(makeEvent(doc), {
    getLabel: () => "Copy Current Reader Attachment",
    getActionState: async () => createReaderActionState(),
    createButton: ({ doc: targetDoc, id, className, title, iconDataURL }) => {
      helperCalls += 1;
      const button = targetDoc.createElement("button");
      button.id = id;
      button.className = className;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.setAttribute("style", `background-image: url("${iconDataURL}")`);
      return button;
    },
  });

  await handle.refresh();

  assert.equal(helperCalls, 1);
});

test("mountReaderToolbarButton reads reader action state and keeps disabled tooltip in sync", async () => {
  await primeToolbarIcon();
  const doc = new FakeDocument();
  const handle = mountReaderToolbarButton(makeEvent(doc, 2048), {
    getLabel: () => "Copy File",
    getActionState: async () => ({
      source: "reader",
      refreshKey: "2048|pdf",
      primary: {
        kind: "copy-files",
        canExecute: false,
        reasonKey: "copy-reader-no-active",
        run: async () => {
          throw new Error("Disabled action should not run.");
        },
      },
    }),
    getActionTooltipText: (_label, state) =>
      state.primary.canExecute ? "Copy File" : "No active reader attachment",
  });

  await handle.refresh();

  assert.equal(doc.button.disabled, true);
  assert.equal(doc.button.title, "No active reader attachment");
});
