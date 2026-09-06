import { config } from "../package.json";

describe("startup", function () {
  it("should have plugin instance defined", function () {
    if (!Zotero[config.addonInstance]?.data.initialized) {
      throw new Error("Plugin instance was not initialized.");
    }
  });
});
