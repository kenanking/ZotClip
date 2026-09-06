import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox140",
        minify: true,
        treeShaking: true,
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },

  test: {
    headless: process.env.ZOTCLIP_TEST_HEADLESS === "1",
    prefs: {
      "intl.locale.requested": process.env.ZOTCLIP_TEST_LOCALE || "en-US",
      "app.update.auto": false,
      "app.update.enabled": false,
      "extensions.zotero.zotclip.testXpi": process.env.ZOTCLIP_TEST_XPI || "",
      "extensions.zotero.zotclip.testVersion":
        process.env.ZOTCLIP_TEST_VERSION || "",
    },
    waitForPlugin: `() => Boolean(Zotero.${pkg.config.addonInstance})`,
  },

  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});
