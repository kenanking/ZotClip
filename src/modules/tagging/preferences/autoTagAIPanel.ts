import {
  DEFAULT_AI_PROMPT,
  getAiApiKeyForProvider,
  getAiPrompt,
  getAiProvider,
  getAiProviderConfig,
  getAutoTagOnAdd,
  getAutoTaggingEnabled,
  getStripConnectorTags,
  persistAiModelForDynamicProviderIfLeaving,
  reconcileAiModelForProvider,
  restoreAiModelForDynamicProviderIfEmpty,
  setAiApiKeyForProvider,
  setPref,
  setProviderEndpointFromUi,
} from "../../../utils/prefs";
import {
  composeDisposables,
  createListenerDisposer,
  createNoopHandle,
} from "../../../utils/disposables";
import { getString } from "../../../utils/locale";
import { resolveProviderRuntimePolicy } from "../core/providerAdapter";
import {
  formatProbeMessage,
  showAutoTagPrefsToast,
  zoteroProbeHttpPost,
} from "./connectionProbeActions";
import { runAiConnectionProbe } from "./aiConnectionProbe";
import { createOllamaPopupDisposer } from "./modelMenuLoader";
import {
  applyProviderEndpointUiState,
  getMenulistSelectedValue,
  type MenulistLike,
  setMenulistValue,
  syncModelFromPrefs,
} from "./providerUiState";

export function registerAutoTagAIPanel(doc: Document): { dispose(): void } {
  const enabledCheckbox = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-auto-tag-enabled]",
  );
  const stripConnectorCheckbox = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-strip-connector-tags]",
  );
  const autoTagOnAddCheckbox = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-auto-tag-on-add]",
  );
  const providerMenulist = doc.querySelector<MenulistLike>(
    "[data-zotclip-ai-provider]",
  );
  const modelMenulist = doc.querySelector<MenulistLike>(
    "[data-zotclip-ai-model-menu]",
  );
  const modelTextInput = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-ai-model-text]",
  );
  const keyInput = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-auto-tag-key]",
  );
  const endpointInput = doc.querySelector<HTMLInputElement>(
    "[data-zotclip-auto-tag-endpoint]",
  );
  const promptTextarea = doc.querySelector<HTMLTextAreaElement>(
    "[data-zotclip-ai-prompt]",
  );
  const promptResetButton = doc.querySelector<HTMLElement>(
    "[data-zotclip-ai-prompt-reset]",
  );
  const testConnectionButton = doc.querySelector<HTMLButtonElement>(
    "[data-zotclip-ai-test-connection]",
  );

  if (
    !enabledCheckbox ||
    !stripConnectorCheckbox ||
    !autoTagOnAddCheckbox ||
    !providerMenulist ||
    !modelMenulist ||
    !modelTextInput ||
    !keyInput ||
    !endpointInput ||
    !promptTextarea ||
    !promptResetButton ||
    !testConnectionButton
  ) {
    return createNoopHandle();
  }

  enabledCheckbox.checked = getAutoTaggingEnabled();
  stripConnectorCheckbox.checked = getStripConnectorTags();
  autoTagOnAddCheckbox.checked = getAutoTagOnAdd();
  promptTextarea.value = getAiPrompt();

  const currentProviderId = getAiProvider();
  const currentConfig = getAiProviderConfig(currentProviderId);
  keyInput.value = getAiApiKeyForProvider(currentProviderId);
  keyInput.placeholder = currentConfig.apiKeyPlaceholder
    ? getString(currentConfig.apiKeyPlaceholder as any)
    : "";
  applyProviderEndpointUiState(currentProviderId, endpointInput);

  setMenulistValue(providerMenulist, currentProviderId);
  restoreAiModelForDynamicProviderIfEmpty(currentProviderId);
  syncModelFromPrefs(currentProviderId, modelMenulist, modelTextInput);

  const ollamaDisposer = createOllamaPopupDisposer(
    modelMenulist,
    endpointInput,
  );

  const disposers = [
    createListenerDisposer(enabledCheckbox, "change", () => {
      setPref("autoTaggingEnabled", enabledCheckbox.checked);
    }),
    createListenerDisposer(stripConnectorCheckbox, "change", () => {
      setPref("stripConnectorTags", stripConnectorCheckbox.checked);
    }),
    createListenerDisposer(autoTagOnAddCheckbox, "change", () => {
      setPref("autoTagOnAdd", autoTagOnAddCheckbox.checked);
    }),
    createListenerDisposer(
      providerMenulist as unknown as EventTarget,
      "command",
      () => {
        const selectedId = getMenulistSelectedValue(providerMenulist);
        persistAiModelForDynamicProviderIfLeaving(getAiProvider());
        setPref("aiProvider", selectedId);

        const config = getAiProviderConfig(selectedId);
        keyInput.value = getAiApiKeyForProvider(selectedId);
        keyInput.placeholder = config.apiKeyPlaceholder
          ? getString(config.apiKeyPlaceholder as any)
          : "";
        applyProviderEndpointUiState(selectedId, endpointInput);

        reconcileAiModelForProvider(selectedId);
        syncModelFromPrefs(selectedId, modelMenulist, modelTextInput);
      },
    ),
    createListenerDisposer(
      modelMenulist as unknown as EventTarget,
      "command",
      () => {
        const value = getMenulistSelectedValue(modelMenulist).trim();
        setPref("aiModel", value);
        if (getMenulistSelectedValue(providerMenulist) === "ollama" && value) {
          setPref("aiLastModelOllama", value);
        }
      },
    ),
    createListenerDisposer(modelTextInput, "change", () => {
      const value = modelTextInput.value.trim();
      setPref("aiModel", value);
      if (getMenulistSelectedValue(providerMenulist) === "custom") {
        if (value) {
          setPref("aiLastModelCustom", value);
        }
        modelTextInput.placeholder = value
          ? ""
          : getString("pref-custom-model-placeholder");
      }
    }),
    createListenerDisposer(keyInput, "change", () => {
      setAiApiKeyForProvider(
        getMenulistSelectedValue(providerMenulist),
        keyInput.value.trim(),
      );
    }),
    createListenerDisposer(endpointInput, "change", () => {
      setProviderEndpointFromUi(
        getMenulistSelectedValue(providerMenulist),
        endpointInput.value,
      );
    }),
    createListenerDisposer(promptTextarea, "change", () => {
      setPref("aiPrompt", promptTextarea.value);
    }),
    createListenerDisposer(promptResetButton, "click", () => {
      promptTextarea.value = DEFAULT_AI_PROMPT;
      setPref("aiPrompt", DEFAULT_AI_PROMPT);
    }),
    createListenerDisposer(
      testConnectionButton,
      "click",
      handleTestConnection(
        providerMenulist,
        endpointInput,
        modelMenulist,
        modelTextInput,
        keyInput,
        testConnectionButton,
      ),
    ),
  ];

  return composeDisposables(...disposers, ollamaDisposer);
}

function handleTestConnection(
  providerMenulist: MenulistLike,
  endpointInput: HTMLInputElement,
  modelMenulist: MenulistLike,
  modelTextInput: HTMLInputElement,
  keyInput: HTMLInputElement,
  button: HTMLButtonElement,
): () => void {
  return () => {
    void (async () => {
      const selectedId = getMenulistSelectedValue(providerMenulist);
      const policy = resolveProviderRuntimePolicy({
        providerId: selectedId,
        endpointOverride: endpointInput.value,
      });
      const model = resolveProbeModelFromUi(
        selectedId,
        modelMenulist,
        modelTextInput,
      );
      const key = keyInput.value.trim();

      button.disabled = true;
      try {
        const result = await runAiConnectionProbe({
          url: policy.endpoint,
          apiKey: key,
          apiKeyRequired: policy.apiKeyRequired,
          model,
          includeJsonObjectResponseFormat:
            policy.includeJsonObjectResponseFormat,
          httpPost: zoteroProbeHttpPost,
        });
        showAutoTagPrefsToast(
          result.ok
            ? getString("pref-ai-test-connection-ok")
            : formatProbeMessage(result.message),
        );
      } finally {
        button.disabled = false;
      }
    })();
  };
}

function resolveProbeModelFromUi(
  providerId: string,
  modelMenulist: MenulistLike,
  modelTextInput: HTMLInputElement,
): string {
  const config = getAiProviderConfig(providerId);
  if (config.modelSource === "free-text") {
    return modelTextInput.value.trim();
  }
  return getMenulistSelectedValue(modelMenulist).trim();
}
