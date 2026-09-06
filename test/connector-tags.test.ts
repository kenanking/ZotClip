import { config } from "../package.json";

describe("Connector tag feedback", function () {
  it("refreshes saved tag rows when incremental removal leaves stale UI", async function () {
    this.timeout(15000);
    const prefNames = [
      "stripConnectorTags",
      "autoTaggingEnabled",
      "autoTagOnAdd",
      "aiProvider",
    ].map((name) => `${config.prefsPrefix}.${name}`);
    const savedPrefs = prefNames.map((name) => Zotero.Prefs.get(name, true));
    const savedAutomaticTags = Zotero.Prefs.get("automaticTags");
    const savedRequest = Zotero.HTTP.request;
    let items: Zotero.Item[] = [];
    let calls = 0;
    let box: any;
    try {
      [true, true, true, "ollama"].forEach((value, i) =>
        Zotero.Prefs.set(prefNames[i], value, true),
      );
      Zotero.Prefs.set("automaticTags", true);
      Zotero.HTTP.request = (async () => {
        calls++;
        return {
          status: 200,
          responseText: JSON.stringify({
            choices: [{ message: { content: '{"tags":["AI audit tag"]}' } }],
          }),
        };
      }) as typeof savedRequest;
      const session = new (Zotero.Server.Connector as any).SaveSession(
        "zotclip-cleanup-audit",
        "saveItems",
        {
          headers: { "User-Agent": "ZotClip regression test" },
          data: {
            uri: "https://example.invalid/",
            items: [
              {
                id: "audit",
                itemType: "journalArticle",
                title: "Synthetic Connector cleanup audit",
                abstractNote: "Synthetic abstract",
                tags: ["Connector keyword"],
                attachments: [],
                notes: [],
              },
            ],
          },
        },
      );
      const target = `L${Zotero.Libraries.userLibraryID}`;
      await session.update(target);
      items = await session.saveItems(target);
      const item = items[0];
      const win = Zotero.getMainWindow();
      box = win.document.createXULElement("tags-box");
      win.document.documentElement!.appendChild(box);
      box.item = item;
      box.editable = true;
      box.hidden = false;
      box.skipRender = false;
      box._section.open = true;
      await box._forceRenderAll();
      assert.equal(
        box.querySelectorAll(".row").length,
        1,
        "Initial automatic tag rendered",
      );
      // Reproduce the reported mismatch: saved count updates, removed rows remain.
      const notify = box.notify.bind(box);
      box.notify = (event: string, ...args: any[]) => {
        if (event === "remove") {
          box.updateCount();
          return;
        }
        return notify(event, ...args);
      };
      for (let i = 0; i < 300 && !item.hasTag("AI audit tag"); i++)
        await Zotero.Promise.delay(20);
      assert.equal(calls, 1);
      assert.ok(item.hasTag("AI audit tag"), "Automatic AI tagging completed");
      assert.equal(
        item.hasTag("Connector keyword"),
        false,
        "Original automatic keyword removed",
      );
      await Zotero.Promise.delay(100);
      const afterAI = item.getTags();
      const rows = [...box.querySelectorAll(".row")].map((row: any) =>
        row.getAttribute("tagName"),
      );
      const uiAudit = { count: box.count, rows, tags: afterAI };
      const auditDir = PathUtils.join(
        PathUtils.parent(PathUtils.parent(PathUtils.profileDir)),
        "validation",
      );
      await IOUtils.makeDirectory(auditDir, { createAncestors: true });
      await IOUtils.writeUTF8(
        PathUtils.join(auditDir, `connector-ui-${Zotero.version}.json`),
        JSON.stringify(uiAudit, null, 2),
      );
      assert.equal(rows.length, afterAI.length, JSON.stringify(uiAudit));
      assert.deepEqual(rows.sort(), afterAI.map((tag) => tag.tag).sort());
    } catch (error) {
      assert.fail(String(error));
    } finally {
      box?.remove();
      Zotero.HTTP.request = savedRequest;
      prefNames.forEach((name, i) =>
        Zotero.Prefs.set(name, savedPrefs[i], true),
      );
      Zotero.Prefs.set("automaticTags", savedAutomaticTags);
      for (const item of items) await item.eraseTx();
    }
  });
});
