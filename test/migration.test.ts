import { config } from "../package.json";
import { FilePickerHelper } from "zotero-plugin-toolkit";
import { registerMigrationSection } from "../src/modules/migration/ui";
import {
  applyImport,
  collectConfiguration,
  exportConfiguration,
  inspectPackageEncryption,
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

  for (const key of [password, undefined]) {
    it(
      "previews and recovers preferences, files and keys: " +
        (key ? "encrypted" : "unencrypted"),
      async function () {
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
        const destination = PathUtils.join(
          directory,
          "roundtrip-" + (key ? "encrypted" : "plain") + ".zotclip",
        );
        await exportConfiguration(window.crypto, data, key, destination);
        const opened = await openPackage(window.crypto, destination, key);
        assert.equal(opened.encrypted, key !== undefined);
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
          const recoveryPath = PathUtils.join(
            directory,
            "recovery-" + (key ? "encrypted" : "plain") + ".zotclip",
          );
          const result = await applyImport(
            window.crypto,
            opened,
            rows,
            key,
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
          const recovery = await openPackage(window.crypto, recoveryPath, key);
          try {
            assert.equal(recovery.manifest.recovery, true);
            const restored = await applyImport(
              window.crypto,
              recovery,
              await planImport(recovery),
              key,
              PathUtils.join(
                directory,
                "undo-recovery-" + (key ? "encrypted" : "plain") + ".zotclip",
              ),
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
      },
    );
  }

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

  async function openMigrationPreferences() {
    const pane = (Zotero.PreferencePanes as any).pluginPanes.find(
      (pane: any) => pane.pluginID === config.addonID,
    );
    const preferences = Zotero.Utilities.Internal.openPreferences(pane.id)!;
    for (
      let i = 0;
      i < 100 &&
      preferences.document.querySelectorAll(
        "#zotclip-migration-categories input",
      ).length !== 6;
      i++
    )
      await Zotero.Promise.delay(50);
    assert.equal(
      preferences.document.querySelectorAll(
        "#zotclip-migration-categories input",
      ).length,
      6,
    );
    return preferences;
  }

  it("exports and previews inline with native settings controls, masked keys and cleanup", async function () {
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
    const preferences = await openMigrationPreferences();
    const doc = preferences.document;
    const original = doc.getElementById("zotclip-migration")!;
    // Keep the real preferences layout; bind the test module to a fresh section
    // so its file-picker stub does not depend on the separately bundled add-on.
    const root = original.cloneNode(true) as HTMLElement;
    original.replaceWith(root);
    let refreshed = 0;
    const handle = registerMigrationSection(doc, async () => {
      refreshed++;
    });
    const el = <T extends HTMLElement>(id: string) =>
      doc.getElementById("zotclip-migration-" + id) as T;
    const idle = async () => {
      for (let i = 0; i < 150 && el<HTMLButtonElement>("import").disabled; i++)
        await Zotero.Promise.delay(50);
      assert.isFalse(
        el<HTMLButtonElement>("import").disabled,
        el("status").textContent!,
      );
    };
    const draw = async (theme: "light" | "dark", state: string) => {
      preferences.browsingContext.prefersColorSchemeOverride = theme;
      for (let i = 0; i < 3; i++) {
        await Zotero.Promise.delay(100);
        root.scrollIntoView({ block: "start" });
      }
      assert.equal(
        preferences.matchMedia("(prefers-color-scheme: dark)").matches,
        theme === "dark",
      );
      assert.isAtMost(
        root.scrollWidth,
        root.clientWidth,
        "Migration fits the settings pane",
      );
      const canvas = doc.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "canvas",
      );
      canvas.width = preferences.innerWidth;
      canvas.height = preferences.innerHeight;
      (canvas.getContext("2d") as any).drawWindow(
        preferences,
        0,
        0,
        canvas.width,
        canvas.height,
        "white",
      );
      const bytes = Uint8Array.from(
        atob(canvas.toDataURL().split(",")[1]),
        (c) => c.charCodeAt(0),
      );
      await IOUtils.write(
        PathUtils.join(
          PathUtils.profileDir,
          "migration-inline-" + state + "-" + theme + ".png",
        ),
        bytes,
      );
    };
    try {
      preferences.resizeTo(1000, 900);
      const title = doc.title;
      assert.equal(
        el<HTMLInputElement>("password").namespaceURI,
        "http://www.w3.org/1999/xhtml",
      );
      assert.isFalse(root.textContent!.includes("zotclip-migration-"));
      assert.isTrue(el<HTMLButtonElement>("apply").disabled);
      const encryption = el<HTMLInputElement>("encrypt");
      const credentials = root.querySelector<HTMLInputElement>(
        '[data-category="credentials"]',
      )!;
      assert.isFalse(encryption.checked);
      assert.isTrue(credentials.checked);
      assert.isTrue(el("password-fields").hidden);
      assert.isFalse(el("plaintext-note").hidden);
      encryption.click();
      assert.isFalse(el("password-fields").hidden);
      assert.isTrue(el("plaintext-note").hidden);
      el<HTMLInputElement>("password").value = password;
      encryption.click();
      assert.isTrue(
        credentials.checked,
        "Disabling encryption keeps AI keys selected",
      );
      assert.equal(el<HTMLInputElement>("password").value, "");
      const outside = doc.querySelector<HTMLInputElement>(
        "[data-zotclip-custom-types]",
      )!;
      assert.isFalse(outside.disabled);
      await draw("light", "settings");
      await draw("dark", "settings");
      preferences.resizeTo(760, 900);
      await draw("light", "narrow");
      preferences.resizeTo(1000, 900);
      const nativeButton = doc.querySelector<HTMLButtonElement>(
        "[data-zotclip-key-save]",
      )!;
      assert.equal(
        preferences.getComputedStyle(el("export")).backgroundColor,
        preferences.getComputedStyle(nativeButton).backgroundColor,
      );
      assert.equal(
        preferences.getComputedStyle(el("export")).borderRadius,
        preferences.getComputedStyle(nativeButton).borderRadius,
      );
      el<HTMLButtonElement>("import").click();
      assert.isTrue(el<HTMLButtonElement>("import").disabled);
      assert.isFalse(
        outside.disabled,
        "Migration does not disable unrelated settings",
      );
      await idle();
      assert.isFalse(el("unlock").hidden);
      assert.isFalse(
        encryption.checked,
        "Encrypted imports do not change the export choice",
      );
      assert.equal(root.querySelectorAll(".zotclip-migration-row").length, 0);
      el<HTMLInputElement>("import-password").value = "wrong-password";
      el<HTMLButtonElement>("unlock-preview").click();
      await idle();
      assert.equal(el("status").dataset.error, "true");
      assert.isTrue(el("preview").hidden);
      el<HTMLInputElement>("import-password").value = password;
      el<HTMLButtonElement>("unlock-preview").click();
      await idle();
      assert.isTrue(el("unlock").hidden);
      assert.equal(el<HTMLInputElement>("import-password").value, "");
      assert.equal(
        root.querySelectorAll(".zotclip-migration-row").length,
        2,
        el("status").textContent!,
      );
      assert.isFalse(root.textContent!.includes("invisible-fixture-key"));
      assert.equal(el<HTMLInputElement>("password").value, "");
      assert.isTrue(el<HTMLButtonElement>("apply").disabled);
      el<HTMLInputElement>("consent").click();
      assert.isFalse(el<HTMLButtonElement>("apply").disabled);
      await draw("light", "preview");
      await draw("dark", "preview");
      chosenPath = PathUtils.join(directory, "ui-recovery.zotclip");
      el<HTMLButtonElement>("apply").click();
      await idle();
      assert.equal(Zotero.Prefs.get(pref, true), 0, el("status").textContent!);
      assert.equal(
        await getAiApiKeyForProvider("custom", endpoint),
        "invisible-fixture-key",
      );
      assert.equal(await IOUtils.exists(chosenPath), true);
      assert.isTrue(await inspectPackageEncryption(chosenPath));
      assert.equal(refreshed, 1);
      assert.ok(el("result").textContent!.includes(chosenPath));
      assert.equal(
        doc.title,
        title,
        "Migration keeps the preferences window title",
      );

      for (const input of root.querySelectorAll<HTMLInputElement>(
        "[data-category]",
      ))
        input.checked = ["preferences", "credentials"].includes(
          input.dataset.category!,
        );
      chosenPath = PathUtils.join(directory, "ui-export.zotclip");
      el<HTMLButtonElement>("export").click();
      await idle();
      assert.equal(
        await IOUtils.exists(chosenPath),
        true,
        el("status").textContent!,
      );
      assert.equal(el<HTMLInputElement>("confirm-password").value, "");
      assert.isFalse(await inspectPackageEncryption(chosenPath));
      const plainPath = chosenPath;
      const exported = await openPackage(window.crypto, plainPath, undefined);
      try {
        assert.ok(
          exported.manifest.entries.some(
            (entry) => entry.kind === "preference" && entry.name === pref,
          ),
        );
        assert.ok(
          exported.manifest.entries.some(
            (entry) =>
              entry.kind === "credential" &&
              entry.value === "invisible-fixture-key",
          ),
        );
      } finally {
        await exported.dispose();
      }

      Zotero.Prefs.set(pref, 9, true);
      await setAiApiKeyForProvider("custom", "before-plain-key", endpoint);
      el<HTMLButtonElement>("import").click();
      await idle();
      assert.isTrue(el("unlock").hidden, "Plain imports need no password");
      assert.isFalse(root.textContent!.includes("invisible-fixture-key"));
      el<HTMLInputElement>("consent").click();
      chosenPath = PathUtils.join(directory, "ui-plain-recovery.zotclip");
      el<HTMLButtonElement>("apply").click();
      await idle();
      assert.equal(Zotero.Prefs.get(pref, true), 0);
      assert.equal(
        await getAiApiKeyForProvider("custom", endpoint),
        "invisible-fixture-key",
      );
      const plainRecovery = await openPackage(
        window.crypto,
        chosenPath,
        undefined,
      );
      try {
        assert.isFalse(plainRecovery.encrypted);
        assert.ok(
          plainRecovery.manifest.entries.some(
            (entry) =>
              entry.kind === "credential" && entry.value === "before-plain-key",
          ),
        );
        await applyImport(
          window.crypto,
          plainRecovery,
          await planImport(plainRecovery),
          undefined,
          PathUtils.join(directory, "ui-plain-undo.zotclip"),
        );
        assert.equal(Zotero.Prefs.get(pref, true), 9);
        assert.equal(
          await getAiApiKeyForProvider("custom", endpoint),
          "before-plain-key",
        );
      } finally {
        await plainRecovery.dispose();
      }

      encryption.click();
      chosenPath = PathUtils.join(directory, "ui-encrypted-export.zotclip");
      el<HTMLInputElement>("password").value = password;
      el<HTMLInputElement>("confirm-password").value = password;
      await draw("light", "encrypted");
      el<HTMLButtonElement>("export").click();
      await idle();
      assert.isTrue(await inspectPackageEncryption(chosenPath));

      chosenPath = plainPath;
      const temp = Zotero.getTempDirectory().path;
      const before = new Set(await IOUtils.getChildren(temp));
      el<HTMLButtonElement>("import").click();
      await idle();
      const staged = (await IOUtils.getChildren(temp)).filter(
        (p) =>
          !before.has(p) &&
          PathUtils.filename(p).startsWith("zotclip-migration-"),
      );
      assert.equal(staged.length, 1);
      el<HTMLInputElement>("password").value = password;
      el<HTMLInputElement>("confirm-password").value = password;
      el<HTMLInputElement>("import-password").value = password;
      handle.dispose();
      assert.equal(el<HTMLInputElement>("password").value, "");
      assert.equal(el<HTMLInputElement>("confirm-password").value, "");
      assert.equal(el<HTMLInputElement>("import-password").value, "");
      for (let i = 0; i < 100 && (await IOUtils.exists(staged[0])); i++)
        await Zotero.Promise.delay(20);
      assert.isFalse(await IOUtils.exists(staged[0]));
      assert.equal(root.querySelectorAll(".zotclip-migration-row").length, 0);
    } finally {
      handle.dispose();
      preferences.close();
      FilePickerHelper.prototype.open = originalPicker;
      (window as any).addon = originalAddon;
    }
  });

  it("mounts the packaged migration controls directly in Preferences without another window", async function () {
    const preferences = await openMigrationPreferences();
    try {
      const doc = preferences.document;
      assert.isNull(doc.getElementById("zotclip-open-migration"));
      const root = doc.getElementById("zotclip-migration")!;
      assert.isFalse(root.textContent!.includes("zotclip-migration-"));
      const button = doc.getElementById(
        "zotclip-migration-export",
      ) as HTMLButtonElement;
      const encryption = doc.getElementById(
        "zotclip-migration-encrypt",
      ) as HTMLInputElement;
      assert.isFalse(encryption.checked);
      encryption.click();
      button.click();
      for (let i = 0; i < 100 && button.disabled; i++)
        await Zotero.Promise.delay(20);
      assert.equal(
        doc
          .getElementById("zotclip-migration-status")!
          .getAttribute("data-error"),
        "true",
      );
      assert.ok(doc.getElementById("zotclip-migration-status")!.textContent);
      const windows = Services.wm.getEnumerator(null);
      while (windows.hasMoreElements()) {
        const candidate = windows.getNext() as Window;
        assert.notEqual(
          candidate.location.href,
          "chrome://" + config.addonRef + "/content/migration.xhtml",
        );
      }
      const passwordInput = doc.getElementById(
        "zotclip-migration-password",
      ) as HTMLInputElement;
      passwordInput.value = password;
      preferences.close();
      for (let i = 0; i < 100 && passwordInput.value; i++)
        await Zotero.Promise.delay(20);
      assert.equal(
        passwordInput.value,
        "",
        "Closing Preferences clears the migration password",
      );
    } finally {
      if (!preferences.closed) preferences.close();
    }
  });
});
