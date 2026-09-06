import { config } from "../package.json";
import { renderApiKeyField } from "../src/modules/tagging/preferences/apiKeyField";

describe("API key field localization", function () {
  it("resolves runtime messages and represents a stored key without filling its value", function () {
    const translate = (key: string): string => {
      const id = `${config.addonRef}-${key}`;
      const value = Zotero[
        config.addonInstance
      ].data.locale.current.formatMessagesSync([{ id }])[0]?.value;
      assert.ok(value, `Missing runtime translation: ${id}`);
      assert.notEqual(value, id);
      return value;
    };
    for (const name of ["saved", "unset", "loading", "unavailable", "error"])
      translate(`pref-key-${name}`);
    const input = window.document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "input",
    ) as HTMLInputElement;
    const status = window.document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div",
    ) as HTMLElement;
    renderApiKeyField(input, status, null, "saved", translate);
    assert.equal(input.value, "");
    assert.equal(input.placeholder, translate("pref-key-saved"));
    assert.equal(status.hidden, true);
  });
});
