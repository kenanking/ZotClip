import assert from "node:assert/strict";
import test from "node:test";

import {
  registerMainToolbarButton,
  type MainToolbarButtonHandle,
} from "../../src/modules/copy/mainToolbarButton";

type EventHandler = (event: Event) => void;

class FakeToolbarButton {
  id = "";
  className = "";
  title = "";
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
}

class FakeAnchor {
  afterCalls: FakeToolbarButton[] = [];
  private onAfter: (node: FakeToolbarButton) => void;

  constructor(onAfter: (node: FakeToolbarButton) => void) {
    this.onAfter = onAfter;
  }

  after(node: FakeToolbarButton): void {
    this.afterCalls.push(node);
    this.onAfter(node);
  }
}

class FakeDocument {
  private elements = new Map<string, FakeToolbarButton | FakeAnchor>();
  readonly preferredAnchor: FakeAnchor;
  createXULElementCalls: string[] = [];

  constructor() {
    this.preferredAnchor = new FakeAnchor((node) => {
      this.elements.set(node.id, node);
    });
    this.elements.set("zotero-tb-note-add", this.preferredAnchor);
  }

  createElement(tagName: string): FakeToolbarButton {
    assert.equal(tagName, "toolbarbutton");
    return new FakeToolbarButton();
  }

  createXULElement(tagName: string): FakeToolbarButton {
    this.createXULElementCalls.push(tagName);
    assert.equal(tagName, "toolbarbutton");
    return new FakeToolbarButton();
  }

  getElementById(id: string): FakeToolbarButton | FakeAnchor | null {
    return this.elements.get(id) || null;
  }
  get button(): FakeToolbarButton {
    const node = this.elements.get("zotclip-main-toolbar-button");
    assert.ok(node);
    return node as FakeToolbarButton;
  }
}

test("registerMainToolbarButton inserts a native toolbarbutton after the preferred anchor", async () => {
  const doc = new FakeDocument();

  const handle = registerMainToolbarButton(doc as unknown as Document, {
    getLabel: () => "Copy Attachment File(s)",
    getAvailability: async () => ({ canCopy: true }),
    onCommand: async () => {},
  });

  await handle.refresh();

  assert.equal(doc.preferredAnchor.afterCalls.length, 1);
  assert.deepEqual(doc.createXULElementCalls, ["toolbarbutton"]);
  assert.equal(doc.button.className, "zotero-tb-button");
  assert.match(doc.button.style, /content\/icons\/toolbar-icon\.svg/);
  assert.equal(doc.button.title, "Copy Attachment File(s)");
  assert.equal(doc.button.disabled, false);
});

test("registerMainToolbarButton disables the button when selection copy is unavailable", async () => {
  const doc = new FakeDocument();

  const handle = registerMainToolbarButton(doc as unknown as Document, {
    getLabel: () => "Copy Attachment File(s)",
    getAvailability: async () => ({
      canCopy: false,
      unavailableMessage: "No eligible attachments selected.",
    }),
    onCommand: async () => {},
  });

  await handle.refresh();

  assert.equal(doc.button.disabled, true);
  assert.equal(doc.button.title, "No eligible attachments selected.");
});

test("registerMainToolbarButton does not insert duplicates on repeated registration", async () => {
  const doc = new FakeDocument();

  const firstHandle = registerMainToolbarButton(doc as unknown as Document, {
    getLabel: () => "Copy Attachment File(s)",
    getAvailability: async () => ({ canCopy: true }),
    onCommand: async () => {},
  });
  const secondHandle = registerMainToolbarButton(doc as unknown as Document, {
    getLabel: () => "Copy Attachment File(s)",
    getAvailability: async () => ({ canCopy: true }),
    onCommand: async () => {},
  });

  await firstHandle.refresh();
  await secondHandle.refresh();

  assert.equal(doc.preferredAnchor.afterCalls.length, 1);
});

test("registerMainToolbarButton runs the copy command only once for a single toolbar activation", async () => {
  const doc = new FakeDocument();
  let calls = 0;

  const handle = registerMainToolbarButton(doc as unknown as Document, {
    getLabel: () => "Copy Attachment File(s)",
    getAvailability: async () => ({ canCopy: true }),
    onCommand: async () => {
      calls += 1;
    },
  });

  await handle.refresh();
  doc.button.dispatch("command");
  doc.button.dispatch("click");

  assert.equal(calls, 1);
});
