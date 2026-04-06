import {
  type AiProviderConfig,
  getAiModel,
  getAiProviderConfig,
  getCustomModelForUi,
  getLmStudioModelForUi,
  getOllamaModelForUi,
  getProviderEndpointForUi,
} from "../../../utils/prefs";
import { getString } from "../../../utils/locale";

export type MenulistLike = HTMLElement & { value: string; selectedItem?: any };

export function createMenuElement(doc: Document): Element {
  return (doc as any).createXULElement
    ? (doc as any).createXULElement("menuitem")
    : doc.createElement("menuitem");
}

export function setMenulistValue(menulist: MenulistLike, value: string): void {
  const items = Array.from(menulist.querySelectorAll("menuitem")) as Array<
    HTMLElement & { value?: string; getAttribute(name: string): string | null }
  >;
  const match =
    items.find(
      (item) => item.value === value || item.getAttribute("value") === value,
    ) ||
    items[0] ||
    null;
  const resolved = (match?.value ??
    match?.getAttribute("value") ??
    value) as string;
  menulist.value = resolved;
  (menulist as any).selectedItem = match;
}

export function getMenulistSelectedValue(menulist: MenulistLike): string {
  return menulist.value || menulist.selectedItem?.value || "";
}

function setModelControlVisibility(
  modelMenulist: MenulistLike,
  modelTextInput: HTMLInputElement,
  config: AiProviderConfig,
): void {
  if (config.modelSource === "free-text") {
    modelMenulist.setAttribute("hidden", "hidden");
    (modelMenulist as any).style.display = "none";
    modelTextInput.removeAttribute("hidden");
    modelTextInput.style.display = "";
    return;
  }
  modelMenulist.removeAttribute("hidden");
  (modelMenulist as any).style.display = "";
  modelTextInput.setAttribute("hidden", "hidden");
  modelTextInput.style.display = "none";
}

export function populateModelOptions(
  modelMenulist: MenulistLike,
  config: AiProviderConfig,
  currentModel: string,
): void {
  const popup = modelMenulist.querySelector("menupopup");
  if (!popup) return;

  while (popup.firstChild) {
    popup.removeChild(popup.firstChild);
  }

  const doc = modelMenulist.ownerDocument!;
  if (
    config.modelSource === "ollama-dynamic" ||
    config.modelSource === "lmstudio-dynamic"
  ) {
    const saved = currentModel.trim();
    if (saved) {
      const item = createMenuElement(doc);
      item.setAttribute("value", saved);
      item.setAttribute("label", saved);
      popup.appendChild(item);
      setMenulistValue(modelMenulist, saved);
    } else {
      const hint = createMenuElement(doc);
      hint.setAttribute("value", "");
      hint.setAttribute("label", getString("pref-ollama-click-to-select"));
      popup.appendChild(hint);
      setMenulistValue(modelMenulist, "");
    }
    return;
  }

  for (const model of config.models) {
    const item = createMenuElement(doc);
    item.setAttribute("value", model.value);
    item.setAttribute("label", model.label);
    popup.appendChild(item);
  }

  const targetModel = config.models.some((m) => m.value === currentModel)
    ? currentModel
    : (config.models[0]?.value ?? "");
  setMenulistValue(modelMenulist, targetModel);
}

export function syncModelFromPrefs(
  providerId: string,
  modelMenulist: MenulistLike,
  modelTextInput: HTMLInputElement,
): void {
  const config = getAiProviderConfig(providerId);
  setModelControlVisibility(modelMenulist, modelTextInput, config);

  if (config.modelSource === "free-text") {
    const model = getCustomModelForUi();
    modelTextInput.value = model;
    modelTextInput.placeholder = model.trim()
      ? ""
      : getString("pref-custom-model-placeholder");
    return;
  }

  modelTextInput.placeholder = "";
  const modelForList =
    config.modelSource === "ollama-dynamic"
      ? getOllamaModelForUi()
      : config.modelSource === "lmstudio-dynamic"
        ? getLmStudioModelForUi()
        : getAiModel();
  populateModelOptions(modelMenulist, config, modelForList);
}

export function applyProviderEndpointUiState(
  providerId: string,
  endpointInput: HTMLInputElement,
): void {
  const config = getAiProviderConfig(providerId);
  endpointInput.value = getProviderEndpointForUi(providerId);
  endpointInput.disabled = !config.endpointEditable;
  endpointInput.placeholder =
    providerId === "custom"
      ? getString("pref-custom-endpoint-placeholder")
      : "";
}
