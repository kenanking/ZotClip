import { config } from "../package.json";

describe("startup", function () {
  it("should have plugin instance defined", function () {
    if (!Zotero[config.addonInstance]) {
      throw new Error("Plugin instance was not initialized.");
    }
  });
});
