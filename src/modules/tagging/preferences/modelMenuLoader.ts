import {
  getAiProvider,
  getOllamaModelForUi,
  setPref,
} from "../../../utils/prefs";
import { fetchOllamaModels } from "../core/ollamaModels";
import { getAddonFaviconUri } from "../../../utils/addonAssets";
import { getString } from "../../../utils/locale";
import type { MenulistLike } from "./providerUiState";
import { setMenulistValue } from "./providerUiState";

function createMenuElement(doc: Document): Element {
  return (doc as any).createXULElement
    ? (doc as any).createXULElement("menuitem")
    : doc.createElement("menuitem");
}

function showOllamaUnavailableToast(): void {
  const icon = getAddonFaviconUri();
  const progressWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
  });
  progressWin.createLine({
    text: getString("auto-tag-ollama-not-running"),
    icon,
    progress: 0,
  });
  progressWin.show(3000);
}

export function createOllamaPopupDisposer(
  modelMenulist: MenulistLike,
  endpointInput: HTMLInputElement,
): () => void {
  const popup = modelMenulist.querySelector("menupopup");
  if (!popup) return () => {};

  const handler = async () => {
    if (getAiProvider() !== "ollama") return;
    const baseUrl = endpointInput.value.trim();
    if (!baseUrl) return;

    try {
      const models = await fetchOllamaModels(baseUrl, (url) =>
        Zotero.HTTP.request("GET", url, { timeout: 5000 }).then((r: any) => ({
          response: r.responseText ?? "",
        })),
      );

      while (popup.firstChild) popup.removeChild(popup.firstChild);
      const doc = modelMenulist.ownerDocument!;
      for (const model of models) {
        const item = createMenuElement(doc);
        item.setAttribute("value", model.value);
        item.setAttribute("label", model.label);
        popup.appendChild(item);
      }

      const currentModel = getOllamaModelForUi();
      const target = models.some((m) => m.value === currentModel)
        ? currentModel
        : (models[0]?.value ?? "");
      setMenulistValue(modelMenulist, target);
      setPref("aiModel", target);
      if (target) {
        setPref("aiLastModelOllama", target);
      }
    } catch {
      while (popup.firstChild) popup.removeChild(popup.firstChild);
      showOllamaUnavailableToast();
    }
  };

  popup.addEventListener("popupshowing", handler as any);
  return () => {
    popup.removeEventListener("popupshowing", handler as any);
  };
}
