import {
  getAiProvider,
  getLmStudioModelForUi,
  getOllamaModelForUi,
  setPref,
} from "../../../utils/prefs";
import { fetchOllamaModels } from "../core/ollamaModels";
import { fetchLmStudioModels } from "../core/lmStudioModels";
import { getString } from "../../../utils/locale";
import { showAutoTagToast } from "../integration/autoTagNotify";
import {
  createMenuElement,
  type MenulistLike,
  setMenulistValue,
} from "./providerUiState";

function showUnavailableToast(providerId: string): void {
  const key =
    providerId === "lmstudio"
      ? "auto-tag-lmstudio-not-running"
      : "auto-tag-ollama-not-running";
  showAutoTagToast(getString(key as any), 3000);
}

export function createDynamicModelPopupDisposer(
  modelMenulist: MenulistLike,
  endpointInput: HTMLInputElement,
): () => void {
  const popup = modelMenulist.querySelector("menupopup");
  if (!popup) return () => {};

  let inFlight = false;
  const handler = async () => {
    const providerId = getAiProvider();
    if (
      (providerId !== "ollama" && providerId !== "lmstudio") ||
      inFlight
    )
      return;
    const baseUrl = endpointInput.value.trim();
    if (!baseUrl) return;

    inFlight = true;
    try {
      const httpFetcher = (url: string) =>
        Zotero.HTTP.request("GET", url, { timeout: 5000 }).then(
          (r: any) => ({
            response: r.responseText ?? "",
          }),
        );

      const models =
        providerId === "lmstudio"
          ? await fetchLmStudioModels(baseUrl, httpFetcher)
          : await fetchOllamaModels(baseUrl, httpFetcher);

      while (popup.firstChild) popup.removeChild(popup.firstChild);
      const doc = modelMenulist.ownerDocument!;
      for (const model of models) {
        const item = createMenuElement(doc);
        item.setAttribute("value", model.value);
        item.setAttribute("label", model.label);
        popup.appendChild(item);
      }

      const currentModel =
        providerId === "lmstudio"
          ? getLmStudioModelForUi()
          : getOllamaModelForUi();
      const target = models.some((m) => m.value === currentModel)
        ? currentModel
        : (models[0]?.value ?? "");
      setMenulistValue(modelMenulist, target);
      setPref("aiModel", target);
      if (target) {
        const lastModelPref =
          providerId === "lmstudio"
            ? "aiLastModelLmstudio"
            : "aiLastModelOllama";
        setPref(lastModelPref, target);
      }
    } catch {
      while (popup.firstChild) popup.removeChild(popup.firstChild);
      showUnavailableToast(providerId);
    } finally {
      inFlight = false;
    }
  };

  popup.addEventListener("popupshowing", handler as any);
  return () => {
    popup.removeEventListener("popupshowing", handler as any);
  };
}

/** @deprecated Use `createDynamicModelPopupDisposer` instead. */
export const createOllamaPopupDisposer = createDynamicModelPopupDisposer;
