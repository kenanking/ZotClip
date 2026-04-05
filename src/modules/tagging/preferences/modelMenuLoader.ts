import {
  getAiProvider,
  getOllamaModelForUi,
  setPref,
} from "../../../utils/prefs";
import { fetchOllamaModels } from "../core/ollamaModels";
import { getString } from "../../../utils/locale";
import { showAutoTagToast } from "../integration/autoTagNotify";
import {
  createMenuElement,
  type MenulistLike,
  setMenulistValue,
} from "./providerUiState";

function showOllamaUnavailableToast(): void {
  showAutoTagToast(getString("auto-tag-ollama-not-running"), 3000);
}

export function createOllamaPopupDisposer(
  modelMenulist: MenulistLike,
  endpointInput: HTMLInputElement,
): () => void {
  const popup = modelMenulist.querySelector("menupopup");
  if (!popup) return () => {};

  let inFlight = false;
  const handler = async () => {
    if (getAiProvider() !== "ollama" || inFlight) return;
    const baseUrl = endpointInput.value.trim();
    if (!baseUrl) return;

    inFlight = true;
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
    } finally {
      inFlight = false;
    }
  };

  popup.addEventListener("popupshowing", handler as any);
  return () => {
    popup.removeEventListener("popupshowing", handler as any);
  };
}
