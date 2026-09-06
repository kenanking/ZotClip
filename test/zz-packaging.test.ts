import { config, version } from "../package.json";

describe("packaged installation", function () {
  it("accepts and installs the production XPI for this Zotero version", async function () {
    this.timeout(30000);
    try {
      const expectedVersion = Zotero.Prefs.get(
        `${config.prefsPrefix}.testVersion`,
        true,
      );
      const path = Zotero.Prefs.get(`${config.prefsPrefix}.testXpi`, true);
      if (!path) this.skip();
      assert.equal(Zotero.version, expectedVersion);
      const { AddonManager } = ChromeUtils.importESModule(
        "resource://gre/modules/AddonManager.sys.mjs",
      );
      // Remove the development-only temporary add-on before a normal installation.
      // Replacing a temporary add-on does not exercise Zotero's normal startup path.
      const temporary = await AddonManager.getAddonByID(config.addonID);
      await temporary.uninstall();
      await Zotero.Promise.delay(100);
      const install = await AddonManager.getInstallForFile(
        Zotero.File.pathToFile(String(path)),
      );
      assert.equal(install.error, 0);
      assert.equal(install.addon.id, config.addonID);
      assert.equal(install.addon.version, version);
      assert.equal(install.addon.isCompatible, true);
      await new Promise<void>((resolve, reject) => {
        install.addListener({
          onInstallEnded: () => resolve(),
          onInstallFailed: () =>
            reject(new Error(`XPI installation failed: ${install.error}`)),
          onInstallCancelled: () =>
            reject(new Error("XPI installation cancelled")),
        });
        Promise.resolve(install.install()).catch(reject);
      });
      const installed = await AddonManager.getAddonByID(config.addonID);
      assert.equal(installed.version, version);
      assert.equal(installed.appDisabled, false);
      assert.equal(installed.isActive, true, "Installed add-on is active");
      for (
        let attempt = 0;
        attempt < 50 && !Zotero[config.addonInstance]?.data.initialized;
        attempt++
      ) {
        await Zotero.Promise.delay(100);
      }
      const errors = Zotero.getErrors(true).filter((line) =>
        /zotclip|zot-clip/i.test(line),
      );
      assert.equal(errors.length, 0, "Production startup has no plugin errors");
      assert.equal(
        Zotero[config.addonInstance]?.data.initialized,
        true,
        "Production add-on completed initialization",
      );
    } catch (error) {
      throw new Error(String(error), { cause: error });
    }
  });
});
