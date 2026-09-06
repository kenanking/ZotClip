import { zoteroAutoTagHttpRequest } from "../core/zoteroAutoTagDeps";
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
  let disposed = false;
  let controller: AbortController | undefined;
  const handler = async () => {
    const providerId = getAiProvider();
    if ((providerId !== "ollama" && providerId !== "lmstudio") || inFlight)
      return;
    const baseUrl = endpointInput.value.trim();
    if (!baseUrl) return;

    inFlight = true;
    controller = new AbortController();
    const signal = controller.signal;
    try {
      const httpFetcher = (url: string) =>
        zoteroAutoTagHttpRequest(url, {
          method: "GET",
          headers: {},
          body: "",
          timeout: 5000,
          signal,
        });

      const models =
        providerId === "lmstudio"
          ? await fetchLmStudioModels(baseUrl, httpFetcher)
          : await fetchOllamaModels(baseUrl, httpFetcher);

      if (
        disposed ||
        signal.aborted ||
        getAiProvider() !== providerId ||
        endpointInput.value.trim() !== baseUrl
      )
        return;
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
      if (disposed || signal.aborted) return;
      while (popup.firstChild) popup.removeChild(popup.firstChild);
      showUnavailableToast(providerId);
    } finally {
      inFlight = false;
    }
  };

  const cancel = () => {
    controller?.abort();
  };
  const doc = modelMenulist.ownerDocument!;
  doc.addEventListener("command", cancel, true);
  endpointInput.addEventListener("change", cancel);
  popup.addEventListener("popupshowing", handler as any);
  return () => {
    disposed = true;
    cancel();
    doc.removeEventListener("command", cancel, true);
    endpointInput.removeEventListener("change", cancel);
    popup.removeEventListener("popupshowing", handler as any);
  };
}
