describe("startup diagnostics", function () {
  it("finishes startup without plugin errors", function () {
    const errors = Zotero.getErrors(true).filter((line) =>
      /zotclip|zot-clip/i.test(line),
    );
    if (errors.length) (window as any).debug({ pluginErrors: errors });
    assert.equal(errors.length, 0, "Plugin startup must finish without errors");
  });
});
