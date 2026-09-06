interface ItemTagsView extends Element {
  item?: Zotero.Item;
  _forceRenderAll(): Promise<void>;
}

/** Reconcile visible tag rows with saved data after automatic tag changes. */
export async function refreshItemTags(itemID: number): Promise<void> {
  for (const win of Zotero.getMainWindows()) {
    for (const element of win.document.querySelectorAll("tags-box")) {
      const view = element as ItemTagsView;
      if (view.item?.id !== itemID) continue;
      try {
        await view._forceRenderAll();
      } catch (error) {
        // A view may close during a save; do not turn a UI failure into an AI failure.
        Zotero.logError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  }
}
