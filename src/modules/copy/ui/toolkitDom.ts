type XULToolbarButton = XULElement & {
  disabled: boolean;
  title: string;
};

type XULDocumentLike = Document & {
  createXULElement?: (tagName: string) => Element;
};

export function createToolbarButtonElement(input: {
  doc: Document;
  id: string;
  className: string;
  title: string;
  iconURL: string;
}): XULToolbarButton {
  const xulDoc = input.doc as XULDocumentLike;
  const button = (xulDoc.createXULElement
    ? xulDoc.createXULElement("toolbarbutton")
    : input.doc.createElement("toolbarbutton")) as XULToolbarButton;
  button.id = input.id;
  button.className = input.className;
  button.setAttribute("tooltiptext", input.title);
  button.title = input.title;
  button.setAttribute("style", `list-style-image: url(${input.iconURL})`);
  return button;
}

export function createReaderToolbarButtonElement(input: {
  doc: Document;
  id: string;
  className: string;
  title: string;
  iconDataURL: string;
}): HTMLButtonElement {
  const button = input.doc.createElement("button");
  button.id = input.id;
  button.className = input.className;
  button.setAttribute("type", "button");
  button.setAttribute("aria-label", input.title);
  button.title = input.title;
  button.textContent = "";
  button.setAttribute(
    "style",
    [
      `background-image: url("${input.iconDataURL}")`,
      "background-position: center",
      "background-repeat: no-repeat",
      "background-size: 16px 16px",
      "width: 28px",
      "height: 28px",
      "min-width: 28px",
      "padding: 0",
    ].join("; "),
  );
  return button;
}
