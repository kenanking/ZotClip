describe("toolbar buttons", function () {
  const samplePdfBase64 =
    "JVBERi0xLjUKJbXtrvsKMyAwIG9iago8PCAvTGVuZ3RoIDQgMCBSCiAgIC9GaWx0ZXIgL0ZsYXRlRGVjb2RlCj4+CnN0cmVhbQp4nCvkCuQCAAKSANcKZW5kc3RyZWFtCmVuZG9iago0IDAgb2JqCiAgIDEyCmVuZG9iagoyIDAgb2JqCjw8Cj4+CmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9QYWdlCiAgIC9QYXJlbnQgMSAwIFIKICAgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU1NzQgODQxLjg4OTc3MSBdCiAgIC9Db250ZW50cyAzIDAgUgogICAvR3JvdXAgPDwKICAgICAgL1R5cGUgL0dyb3VwCiAgICAgIC9TIC9UcmFuc3BhcmVuY3kKICAgICAgL0NTIC9EZXZpY2VSR0IKICAgPj4KICAgL1Jlc291cmNlcyAyIDAgUgo+PgplbmRvYmoKMSAwIG9iago8PCAvVHlwZSAvUGFnZXMKICAgL0tpZHMgWyA1IDAgUiBdCiAgIC9Db3VudCAxCj4+CmVuZG9iago2IDAgb2JqCjw8IC9DcmVhdG9yIChjYWlybyAxLjEwLjIgKGh0dHA6Ly9jYWlyb2dyYXBoaWNzLm9yZykpCiAgIC9Qcm9kdWNlciAoY2Fpcm8gMS4xMC4yIChodHRwOi8vY2Fpcm9ncmFwaGljcy5vcmcpKQo+PgplbmRvYmoKNyAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZwogICAvUGFnZXMgMSAwIFIKPj4KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDM2MCAwMDAwMCBuIAowMDAwMDAwMTI1IDAwMDAwIG4gCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDEwNCAwMDAwMCBuIAowMDAwMDAwMTQ2IDAwMDAwIG4gCjAwMDAwMDA0MjUgMDAwMDAgbiAKMDAwMDAwMDU1MiAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDgKICAgL1Jvb3QgNyAwIFIKICAgL0luZm8gNiAwIFIKPj4Kc3RhcnR4cmVmCjYwNAolJUVPRgo=";
  const mainToolbarButtonID = "zotclip-main-toolbar-button";
  const readerToolbarButtonID = "zotclip-reader-copy-button";
  let attachmentPath = "";
  let attachment: Zotero.Item | undefined;
  let tabReader: _ZoteroTypes.ReaderInstance | undefined;
  let windowReader: _ZoteroTypes.ReaderInstance | undefined;

  async function waitFor<T>(
    getValue: () => T | null | undefined,
    timeoutMs = 20000,
    intervalMs = 100,
  ): Promise<T> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const value = getValue();
      if (value) {
        return value;
      }
      await Zotero.Promise.delay(intervalMs);
    }
    throw new Error("Timed out waiting for toolbar button.");
  }

  before(async function () {
    this.timeout(30000);
    attachmentPath = await writeSamplePdf();
    attachment = await Zotero.Attachments.importFromFile({
      file: attachmentPath,
      libraryID: Zotero.Libraries.userLibraryID,
      title: "ZotClip Toolbar Buttons Test",
      contentType: "application/pdf",
    });
  });

  after(async function () {
    this.timeout(30000);
    windowReader?.close();
    tabReader?.close();
    if (attachment) {
      await attachment.eraseTx();
    }
    if (attachmentPath) {
      await IOUtils.remove(attachmentPath, { ignoreAbsent: true });
    }
  });

  it("shows the main-window toolbar button", async function () {
    this.timeout(30000);

    const mainWindow = Zotero.getMainWindow();
    const button = await waitFor(() =>
      mainWindow.document.getElementById(mainToolbarButtonID),
    );

    assert.ok(button, "Expected the main toolbar button to exist.");
  });

  it("shows the reader toolbar button in both tab and standalone readers", async function () {
    this.timeout(60000);

    tabReader = (await Zotero.Reader.open(attachment!.id, undefined, {
      allowDuplicate: true,
    })) as _ZoteroTypes.ReaderInstance;
    const tabButton = await waitFor(() =>
      tabReader?._iframeWindow?.document.getElementById(readerToolbarButtonID),
    );

    windowReader = (await Zotero.Reader.open(attachment!.id, undefined, {
      allowDuplicate: true,
      openInWindow: true,
    })) as _ZoteroTypes.ReaderInstance;
    const windowButton = await waitFor(() =>
      windowReader?._iframeWindow?.document.getElementById(
        readerToolbarButtonID,
      ),
    );

    assert.ok(tabButton, "Expected the reader toolbar button in a reader tab.");
    assert.ok(
      windowButton,
      "Expected the reader toolbar button in a standalone reader window.",
    );
    assert.equal((tabButton as HTMLButtonElement).disabled, false);
    assert.equal((windowButton as HTMLButtonElement).disabled, false);
  });

  it("uses the shared toolbar icon inside the reader iframe", async function () {
    this.timeout(30000);

    tabReader = (await Zotero.Reader.open(attachment!.id, undefined, {
      allowDuplicate: true,
    })) as _ZoteroTypes.ReaderInstance;
    const iframeWindow = await waitFor(() => tabReader?._iframeWindow);
    const button = await waitFor(() =>
      iframeWindow.document.getElementById(readerToolbarButtonID),
    );
    const backgroundImage =
      iframeWindow.getComputedStyle(button).backgroundImage;

    assert.match(
      backgroundImage,
      /^url\("chrome:\/\/zotclip\/content\/icons\/toolbar-icon\.svg"/,
    );
  });

  async function writeSamplePdf(): Promise<string> {
    const path = PathUtils.join(
      Zotero.getTempDirectory().path,
      "zotclip-toolbar-buttons-test.pdf",
    );
    const bytes = Uint8Array.from(atob(samplePdfBase64), (char) =>
      char.charCodeAt(0),
    );
    await IOUtils.write(path, bytes);
    return path;
  }
});
