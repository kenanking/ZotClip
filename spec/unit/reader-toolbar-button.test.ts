import assert from "node:assert/strict";
import test from "node:test";

import {
  mountReaderToolbarButton,
  type ReaderToolbarRenderEventLike,
} from "../../src/modules/copy/readerToolbarButton";

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
  private elements = new Map<string, FakeButton>();

  createElement(tagName: string): FakeButton {
    assert.equal(tagName, "button");
    return new FakeButton();
  }

  getElementById(id: string): FakeButton | null {
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

test("mountReaderToolbarButton appends an icon-only button through renderToolbar", async () => {
  const doc = new FakeDocument();
  const handle = mountReaderToolbarButton(makeEvent(doc), {
    getLabel: () => "Copy Current Reader Attachment",
    getAvailability: async () => ({ canCopy: true }),
    onCommand: async () => {},
  });

  await handle.refresh();

  assert.equal(doc.appended.length, 1);
  assert.match(doc.button.className, /zotclip-reader-toolbar-button/);
  assert.match(doc.button.style, /content\/icons\/toolbar-icon\.svg/);
  assert.equal(doc.button.textContent, "");
  assert.equal(doc.button.title, "Copy Current Reader Attachment");
  assert.equal(doc.button.disabled, false);
});

test("mountReaderToolbarButton keeps the button visible but disabled when reader copy is unavailable", async () => {
  const doc = new FakeDocument();
  const handle = mountReaderToolbarButton(makeEvent(doc), {
    getLabel: () => "Copy Current Reader Attachment",
    getAvailability: async () => ({
      canCopy: false,
      unavailableMessage: "No eligible reader attachment.",
    }),
    onCommand: async () => {},
  });

  await handle.refresh();

  assert.equal(doc.button.disabled, true);
  assert.equal(doc.button.title, "No eligible reader attachment.");
});

test("mountReaderToolbarButton click uses the current reader item id", async () => {
  const doc = new FakeDocument();
  let clickedItemID: number | undefined;
  const handle = mountReaderToolbarButton(makeEvent(doc, 2048), {
    getLabel: () => "Copy Current Reader Attachment",
    getAvailability: async () => ({ canCopy: true }),
    onCommand: async (itemID) => {
      clickedItemID = itemID;
    },
  });

  await handle.refresh();
  doc.button.dispatch("click");

  assert.equal(clickedItemID, 2048);
});

test("mountReaderToolbarButton does not append duplicates for the same reader document", async () => {
  const doc = new FakeDocument();
  const firstHandle = mountReaderToolbarButton(makeEvent(doc), {
    getLabel: () => "Copy Current Reader Attachment",
    getAvailability: async () => ({ canCopy: true }),
    onCommand: async () => {},
  });
  const secondHandle = mountReaderToolbarButton(makeEvent(doc), {
    getLabel: () => "Copy Current Reader Attachment",
    getAvailability: async () => ({ canCopy: true }),
    onCommand: async () => {},
  });

  await firstHandle.refresh();
  await secondHandle.refresh();

  assert.equal(doc.appended.length, 1);
});
