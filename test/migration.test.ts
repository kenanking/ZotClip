import { config } from "../package.json";
import { FilePickerHelper } from "zotero-plugin-toolkit";
import { mountMigrationWindow } from "../src/modules/migration/ui";
import {
  applyImport,
  collectConfiguration,
  exportConfiguration,
  openPackage,
  planImport,
  type Collection,
} from "../src/modules/migration/service";
import {
  getAiApiKeyForProvider,
  setAiApiKeyForProvider,
} from "../src/modules/tagging/credentials/zoteroCredentials";
import type { Entry } from "../src/modules/migration/types";

describe("configuration migration", function () {
  this.timeout(30000);
  const password = "fixture-password-only";
  const pref = "extensions.zotero.zotclip.fixtureValue";
  const endpoint = "https://migration-fixture.invalid";
  let directory: string;
  let resource: string;
  const resourceName = "zotclip-fixture/nested/配置.txt";
  const manager = () =>
    ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs")
      .AddonManager;
  const addonID = "migration-fixture@example.invalid";
  function collection(
    entries: Entry[],
    files = new Map<string, string>(),
  ): Collection {
    return {
      manifest: {
        format: 1,
        createdAt: new Date().toISOString(),
        source: {
          zotero: Zotero.version,
          zotclip: "fixture",
          platform: "Windows",
        },
        entries,
        omitted: [],
        recovery: false,
      },
      files,
    };
  }
  async function rejects(work: Promise<unknown>, message: string) {
    let caught: unknown;
    try {
      await work;
    } catch (error) {
      caught = error;
    }
    assert.equal((caught as Error)?.message, message);
  }

  before(async function () {
    directory = PathUtils.join(
      Zotero.getTempDirectory().path,
      `zotclip-fixture-${Zotero.randomString(12)}`,
    );
    await IOUtils.makeDirectory(directory);
    resource = PathUtils.join(
      Zotero.DataDirectory.dir,
      "locate",
      ...resourceName.split("/"),
    );
  });

  afterEach(async function () {
    for (const name of Services.prefs.getChildList(
      "extensions.zotero.zotclip.fixture",
    ))
      Zotero.Prefs.clear(name, true);
    await setAiApiKeyForProvider("custom", "", endpoint);
    await IOUtils.remove(
      PathUtils.join(Zotero.DataDirectory.dir, "locate", "zotclip-fixture"),
      { recursive: true, ignoreAbsent: true },
    );
    const addon = await manager().getAddonByID(addonID);
    if (addon) await addon.uninstall();
  });

  after(async function () {
    await IOUtils.remove(directory, { recursive: true });
  });

  it("collects false, zero, empty values and scoped AI credentials", async function () {
    for (const [suffix, value] of [
      ["False", false],
      ["Zero", 0],
      ["Empty", ""],
      ["ApiKey", "excluded"],
    ] as const)
      Zotero.Prefs.set(`${pref}${suffix}`, value, true);
    await setAiApiKeyForProvider("custom", "fixture-only-key", endpoint);
    const data = await collectConfiguration(
      new Set(["preferences", "credentials"]),
    );
    for (const [suffix, value] of [
      ["False", false],
      ["Zero", 0],
      ["Empty", ""],
    ] as const) {
      assert.deepEqual(
        data.manifest.entries.find(
          (e) => e.kind === "preference" && e.name === `${pref}${suffix}`,
        ),
        { kind: "preference", name: `${pref}${suffix}`, value },
      );
    }
    assert.isFalse(
      data.manifest.entries.some(
        (e) => e.kind === "preference" && e.name === `${pref}ApiKey`,
      ),
    );
    assert.deepInclude(data.manifest.entries, {
      kind: "credential",
      provider: "custom",
      origin: endpoint,
      value: "fixture-only-key",
    });
  });

  it("previews without writes, restores preferences, files and keys from an encrypted recovery package", async function () {
    const input = PathUtils.join(directory, "payload.txt");
    await IOUtils.writeUTF8(input, "incoming file");
    const data = collection(
      [
        { kind: "preference", name: pref, value: false },
        {
          kind: "credential",
          provider: "custom",
          origin: endpoint,
          value: "incoming-key",
        },
        {
          kind: "file",
          category: "locate",
          path: resourceName,
          size: (await IOUtils.stat(input)).size!,
        },
      ],
      new Map([[`locate/${resourceName}`, input]]),
    );
    Zotero.Prefs.set(pref, true, true);
    await setAiApiKeyForProvider("custom", "previous-key", endpoint);
    const destination = PathUtils.join(directory, "roundtrip.zotclip");
    await exportConfiguration(window.crypto, data, password, destination);
    const opened = await openPackage(window.crypto, destination, password);
    let staged: string | undefined;
    try {
      staged = [...opened.files.values()][0];
      const rows = await planImport(opened);
      assert.equal(Zotero.Prefs.get(pref, true), true);
      assert.equal(await IOUtils.exists(resource), false);
      assert.deepEqual(
        rows.map((row) => row.status),
        ["replace", "replace", "add"],
      );
      const recoveryPath = PathUtils.join(directory, "recovery.zotclip");
      const result = await applyImport(
        window.crypto,
        opened,
        rows,
        password,
        recoveryPath,
      );
      assert.deepEqual(result.failed, []);
      assert.equal(result.completed.length, 3);
      assert.equal(Zotero.Prefs.get(pref, true), false);
      assert.equal(await IOUtils.readUTF8(resource), "incoming file");
      const resources = await collectConfiguration(new Set(["locate"]));
      assert.ok(resources.files.has(`locate/${resourceName}`));
      assert.equal(
        await getAiApiKeyForProvider("custom", endpoint),
        "incoming-key",
      );
      const recovery = await openPackage(window.crypto, recoveryPath, password);
      try {
        assert.equal(recovery.manifest.recovery, true);
        const restored = await applyImport(
          window.crypto,
          recovery,
          await planImport(recovery),
          password,
          PathUtils.join(directory, "undo-recovery.zotclip"),
        );
        assert.deepEqual(restored.failed, []);
        assert.equal(Zotero.Prefs.get(pref, true), true);
        assert.equal(
          await getAiApiKeyForProvider("custom", endpoint),
          "previous-key",
        );
        assert.equal(await IOUtils.exists(resource), false);
      } finally {
        await recovery.dispose();
      }
    } finally {
      await opened.dispose();
    }
    assert.equal(await IOUtils.exists(staged!), false);
  });

  it("recovery restores overwritten files and removes newly introduced preferences and credentials", async function () {
    await IOUtils.makeDirectory(PathUtils.parent(resource)!, {
      createAncestors: true,
    });
    await IOUtils.writeUTF8(resource, "original content");
    const incoming = PathUtils.join(directory, "overwrite.txt");
    await IOUtils.writeUTF8(incoming, "replacement");
    const data = collection(
      [
        { kind: "preference", name: pref, value: "new setting" },
        {
          kind: "credential",
          provider: "custom",
          origin: endpoint,
          value: "new key",
        },
        {
          kind: "file",
          category: "locate",
          path: resourceName,
          size: (await IOUtils.stat(incoming)).size!,
        },
      ],
      new Map([[`locate/${resourceName}`, incoming]]),
    );
    const recoveryPath = PathUtils.join(
      directory,
      "overwrite-recovery.zotclip",
    );
    const first = await applyImport(
      window.crypto,
      data,
      await planImport(data),
      password,
      recoveryPath,
    );
    assert.deepEqual(first.failed, []);
    assert.equal(await IOUtils.readUTF8(resource), "replacement");
    const recovery = await openPackage(window.crypto, recoveryPath, password);
    try {
      const restored = await applyImport(
        window.crypto,
        recovery,
        await planImport(recovery),
        password,
        PathUtils.join(directory, "overwrite-undo.zotclip"),
      );
      assert.deepEqual(restored.failed, []);
      assert.equal(Services.prefs.prefHasUserValue(pref), false);
      assert.equal(await getAiApiKeyForProvider("custom", endpoint), "");
      assert.equal(await IOUtils.readUTF8(resource), "original content");
    } finally {
      await recovery.dispose();
    }
  });

  it("rejects stale previews and unmapped paths before creating a recovery or changing settings", async function () {
    Zotero.Prefs.set(pref, 1, true);
    const data = collection([{ kind: "preference", name: pref, value: 2 }]);
    const rows = await planImport(data);
    Zotero.Prefs.set(pref, 3, true);
    const recovery = PathUtils.join(directory, "should-not-exist.zotclip");
    await rejects(
      applyImport(window.crypto, data, rows, password, recovery),
      "migration-target-changed",
    );
    assert.equal(Zotero.Prefs.get(pref, true), 3);
    assert.equal(await IOUtils.exists(recovery), false);
    const paths = collection([
      { kind: "path", name: `${pref}Path`, value: "C:\\old-machine\\files" },
    ]);
    const pathRows = await planImport(paths);
    assert.equal(pathRows[0].selected, false);
    pathRows[0].selected = true;
    await rejects(
      applyImport(window.crypto, paths, pathRows, password, recovery),
      "migration-path-required",
    );
    assert.equal(Services.prefs.prefHasUserValue(`${pref}Path`), false);
    pathRows[0].mapping = directory;
    const result = await applyImport(
      window.crypto,
      paths,
      pathRows,
      password,
      recovery,
    );
    assert.deepEqual(result.failed, []);
    assert.equal(Zotero.Prefs.get(`${pref}Path`, true), directory);
  });

  it("cleans failed exports and rejects overwrites", async function () {
    const target = PathUtils.join(directory, "cancelled.zotclip");
    const before = await IOUtils.getChildren(directory);
    const controller = new AbortController();
    controller.abort();
    try {
      await exportConfiguration(
        window.crypto,
        collection([]),
        password,
        target,
        controller.signal,
      );
    } catch {
      /* cancellation */
    }
    assert.deepEqual(await IOUtils.getChildren(directory), before);
    await IOUtils.writeUTF8(target, "existing data");
    await rejects(
      exportConfiguration(window.crypto, collection([]), password, target),
      "migration-output-exists",
    );
    assert.equal(await IOUtils.readUTF8(target), "existing data");
  });

  async function fixtureAddon(version: string) {
    const manifest = PathUtils.join(directory, "manifest.json");
    const bootstrap = PathUtils.join(directory, "bootstrap.js");
    await IOUtils.writeUTF8(
      manifest,
      JSON.stringify({
        manifest_version: 2,
        name: "ZotClip migration test",
        version,
        applications: {
          zotero: {
            id: addonID,
            update_url: "https://migration-fixture.invalid/update.json",
            strict_min_version: "8.0",
            strict_max_version: "*",
          },
        },
      }),
    );
    await IOUtils.writeUTF8(
      bootstrap,
      "function install() {} function startup() {} function shutdown() {} function uninstall() {}",
    );
    const path = PathUtils.join(directory, `addon-${version}.xpi`);
    const zip = Components.classes["@mozilla.org/zipwriter;1"].createInstance(
      Components.interfaces.nsIZipWriter,
    );
    zip.open(Zotero.File.pathToFile(path), 0x04 | 0x08 | 0x20);
    try {
      zip.addEntryFile(
        "manifest.json",
        zip.COMPRESSION_DEFAULT,
        Zotero.File.pathToFile(manifest),
        false,
      );
      zip.addEntryFile(
        "bootstrap.js",
        zip.COMPRESSION_DEFAULT,
        Zotero.File.pathToFile(bootstrap),
        false,
      );
    } finally {
      zip.close();
    }
    return collection(
      [
        {
          kind: "file",
          category: "addons",
          path: `${addonID}.xpi`,
          size: (await IOUtils.stat(path)).size!,
          addon: { id: addonID, version, disabled: true },
        },
      ],
      new Map([[`addons/${addonID}.xpi`, path]]),
    );
  }

  it("installs compatible add-ons with their disabled state and skips ordinary downgrades", async function () {
    const data = await fixtureAddon("2.0");
    const rows = await planImport(data);
    assert.equal(rows[0].status, "add");
    const result = await applyImport(
      window.crypto,
      data,
      rows,
      password,
      PathUtils.join(directory, "addon-recovery.zotclip"),
    );
    assert.deepEqual(result.failed, []);
    const installed = await manager().getAddonByID(addonID);
    assert.equal(installed.version, "2.0");
    assert.equal(installed.userDisabled, true);
    const older = await fixtureAddon("1.0");
    assert.equal((await planImport(older))[0].reason, "migration-addon-newer");
    older.manifest.recovery = true;
    assert.equal((await planImport(older))[0].status, "replace");
    const exported = await collectConfiguration(new Set(["addons"]));
    assert.ok(
      exported.manifest.entries.find(
        (e) => e.kind === "file" && e.addon?.id === addonID,
      ),
    );
    assert.isFalse(
      exported.manifest.entries.some(
        (e) => e.kind === "file" && e.addon?.id === config.addonID,
      ),
    );
  });

  it("renders localized themed controls, verifies a package before preview and masks keys", async function () {
    const originalAddon = (window as any).addon;
    (window as any).addon = Zotero[config.addonInstance];
    const originalPicker = FilePickerHelper.prototype.open;
    const path = PathUtils.join(directory, "ui.zotclip");
    await exportConfiguration(
      window.crypto,
      collection([
        {
          kind: "credential",
          provider: "custom",
          origin: endpoint,
          value: "invisible-fixture-key",
        },
        { kind: "preference", name: pref, value: 0 },
      ]),
      password,
      path,
    );
    let chosenPath = path;
    FilePickerHelper.prototype.open = async () => chosenPath;
    let mounted!: Window;
    const win = Zotero.getMainWindow().openDialog(
      `chrome://${config.addonRef}/content/migration.xhtml`,
      "",
      "chrome,width=860,height=760",
      {
        mount: (target: Window) => {
          mounted = target;
          mountMigrationWindow(target);
        },
      },
    )!;
    try {
      for (let i = 0; i < 50 && !mounted; i++) await Zotero.Promise.delay(50);
      assert.ok(mounted);
      const migration = mounted!;
      const doc = migration.document;
      assert.equal(doc.querySelectorAll("#categories input").length, 6);
      assert.isFalse(doc.body.textContent!.includes("zotclip-migration-"));
      assert.equal(
        (doc.getElementById("apply") as HTMLButtonElement).disabled,
        true,
      );
      (doc.getElementById("password") as HTMLInputElement).value = password;
      (doc.getElementById("import") as HTMLButtonElement).click();
      for (let i = 0; i < 100 && !doc.querySelector(".row"); i++)
        await Zotero.Promise.delay(50);
      assert.equal(
        doc.querySelectorAll(".row").length,
        2,
        doc.getElementById("status")!.textContent!,
      );
      assert.isFalse(doc.body.textContent!.includes("invisible-fixture-key"));
      assert.equal(
        (doc.getElementById("password") as HTMLInputElement).value,
        "",
      );
      assert.equal(
        (doc.getElementById("apply") as HTMLButtonElement).disabled,
        true,
      );
      (doc.getElementById("consent") as HTMLInputElement).click();
      assert.equal(
        (doc.getElementById("apply") as HTMLButtonElement).disabled,
        false,
      );
      const draw = async (theme: string) => {
        doc.documentElement.style.colorScheme = theme;
        await Zotero.Promise.delay(100);
        const canvas = window.document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "canvas",
        ) as HTMLCanvasElement;
        canvas.width = migration.innerWidth;
        canvas.height = doc.documentElement.scrollHeight;
        const context = canvas.getContext("2d")!;
        (context as any).drawWindow(
          migration,
          0,
          0,
          canvas.width,
          canvas.height,
          "white",
        );
        const data = Uint8Array.from(
          atob(canvas.toDataURL().split(",")[1]),
          (c) => c.charCodeAt(0),
        );
        await IOUtils.write(
          PathUtils.join(PathUtils.profileDir, `migration-${theme}.png`),
          data,
        );
      };
      await draw("light");
      await draw("dark");
      chosenPath = PathUtils.join(directory, "ui-recovery.zotclip");
      (doc.getElementById("apply") as HTMLButtonElement).click();
      for (
        let i = 0;
        i < 100 && !(doc.getElementById("preview") as HTMLElement).hidden;
        i++
      )
        await Zotero.Promise.delay(50);
      assert.equal(
        Zotero.Prefs.get(pref, true),
        0,
        doc.getElementById("status")!.textContent!,
      );
      assert.equal(
        await getAiApiKeyForProvider("custom", endpoint),
        "invisible-fixture-key",
      );
      assert.equal(await IOUtils.exists(chosenPath), true);
    } finally {
      win.close();
      FilePickerHelper.prototype.open = originalPicker;
      (window as any).addon = originalAddon;
    }
  });

  it("opens the packaged migration window from the actual preferences pane", async function () {
    const pane = (Zotero.PreferencePanes as any).pluginPanes.find(
      (pane: any) => pane.pluginID === config.addonID,
    );
    const preferences = Zotero.Utilities.Internal.openPreferences(pane.id)!;
    let migration: Window | undefined;
    try {
      for (
        let i = 0;
        i < 100 &&
        !preferences.document.getElementById("zotclip-open-migration");
        i++
      )
        await Zotero.Promise.delay(50);
      const button = preferences.document.getElementById(
        "zotclip-open-migration",
      ) as HTMLButtonElement;
      assert.ok(button);
      button.click();
      for (let i = 0; i < 50 && !migration; i++) {
        const windows = Services.wm.getEnumerator(null);
        while (windows.hasMoreElements()) {
          const candidate = windows.getNext() as Window;
          if (
            candidate.location.href ===
            `chrome://${config.addonRef}/content/migration.xhtml`
          )
            migration = candidate;
        }
        await Zotero.Promise.delay(50);
      }
      assert.ok(migration);
      assert.equal(
        migration!.document.querySelectorAll("#categories input").length,
        6,
      );
      assert.isFalse(
        migration!.document.body.textContent!.includes("zotclip-migration-"),
      );
      const scope: Record<string, unknown> = {};
      const scopeFixture = PathUtils.join(directory, "scope.js");
      await IOUtils.writeUTF8(
        scopeFixture,
        "var encoderType = typeof TextEncoder; var decoderType = typeof TextDecoder;",
      );
      Services.scriptloader.loadSubScript(
        Services.io.newFileURI(Zotero.File.pathToFile(scopeFixture)).spec,
        scope,
      );
      assert.equal(scope.encoderType, "function");
      assert.equal(scope.decoderType, "function");
    } finally {
      migration?.close();
      preferences.close();
    }
  });
});
