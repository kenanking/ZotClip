import {
  getAiApiKeyForProvider,
  setAiApiKeyForProvider,
  migrateAiCredentials,
} from "../credentials/zoteroCredentials";
import {
  DEFAULT_AI_PROMPT,
  getAiPrompt,
  getAiProvider,
  getAiProviderConfig,
  getAutoTagOnAdd,
  getAutoTaggingEnabled,
  getStripConnectorTags,
  persistAiModelForDynamicProviderIfLeaving,
  reconcileAiModelForProvider,
  restoreAiModelForDynamicProviderIfEmpty,
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
import { createDynamicModelPopupDisposer } from "./modelMenuLoader";
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

  let disposed = false;
  let revision = 0;
  let requestController = new AbortController();
  const keyStatus = doc.querySelector<HTMLElement>("[data-zotclip-key-status]");
  const saveKey = doc.querySelector<HTMLButtonElement>(
    "[data-zotclip-key-save]",
  );
  const deleteKey = doc.querySelector<HTMLButtonElement>(
    "[data-zotclip-key-delete]",
  );
  const endpoint = () =>
    resolveProviderRuntimePolicy({
      providerId: getMenulistSelectedValue(providerMenulist),
      endpointOverride: endpointInput.value,
    }).endpoint;
  const cancelRequests = () => {
    revision++;
    requestController.abort();
    requestController = new AbortController();
  };
  async function refreshKeyStatus() {
    const current = ++revision;
    try {
      await migrateAiCredentials();
      const key = await getAiApiKeyForProvider(
        getMenulistSelectedValue(providerMenulist!),
        endpoint(),
      );
      if (!disposed && current === revision && keyStatus)
        keyStatus.textContent = getString(
          key ? "pref-key-saved" : "pref-key-unset",
        );
    } catch {
      if (!disposed && current === revision && keyStatus)
        keyStatus.textContent = getString("pref-key-error");
    }
  }
  async function changeKey(remove: boolean) {
    const current = ++revision;
    const provider = getMenulistSelectedValue(providerMenulist!);
    const value = remove ? "" : keyInput!.value.trim();
    const targetEndpoint = endpoint();
    if (!remove && !value) return;
    try {
      // Complete any pending legacy migration before an explicit replacement/deletion.
      await migrateAiCredentials();
      await setAiApiKeyForProvider(provider, value, targetEndpoint);
      if (!disposed && current === revision) {
        keyInput!.value = "";
        await refreshKeyStatus();
      }
    } catch {
      if (!disposed && current === revision && keyStatus)
        keyStatus.textContent = getString("pref-key-error");
    }
  }
  enabledCheckbox.checked = getAutoTaggingEnabled();
  stripConnectorCheckbox.checked = getStripConnectorTags();
  autoTagOnAddCheckbox.checked = getAutoTagOnAdd();
  promptTextarea.value = getAiPrompt();

  const currentProviderId = getAiProvider();
  const currentConfig = getAiProviderConfig(currentProviderId);
  keyInput.value = "";
  keyInput.placeholder = currentConfig.apiKeyPlaceholder
    ? getString(currentConfig.apiKeyPlaceholder as any)
    : "";
  applyProviderEndpointUiState(currentProviderId, endpointInput);

  setMenulistValue(providerMenulist, currentProviderId);
  restoreAiModelForDynamicProviderIfEmpty(currentProviderId);
  syncModelFromPrefs(currentProviderId, modelMenulist, modelTextInput);

  const ollamaDisposer = createDynamicModelPopupDisposer(
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
        cancelRequests();
        keyInput.value = "";
        keyInput.placeholder = config.apiKeyPlaceholder
          ? getString(config.apiKeyPlaceholder as any)
          : "";
        applyProviderEndpointUiState(selectedId, endpointInput);

        reconcileAiModelForProvider(selectedId);
        syncModelFromPrefs(selectedId, modelMenulist, modelTextInput);
        void refreshKeyStatus();
      },
    ),
    createListenerDisposer(
      modelMenulist as unknown as EventTarget,
      "command",
      () => {
        const value = getMenulistSelectedValue(modelMenulist).trim();
        setPref("aiModel", value);
        const providerId = getMenulistSelectedValue(providerMenulist);
        if (providerId === "ollama" && value) {
          setPref("aiLastModelOllama", value);
        }
        if (providerId === "lmstudio" && value) {
          setPref("aiLastModelLmstudio", value);
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
    createListenerDisposer(endpointInput, "change", () => {
      cancelRequests();
      keyInput.value = "";
      setProviderEndpointFromUi(
        getMenulistSelectedValue(providerMenulist),
        endpointInput.value,
      );
      void refreshKeyStatus();
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
        () => requestController.signal,
      ),
    ),
  ];

  if (saveKey)
    disposers.push(
      createListenerDisposer(saveKey, "click", () => {
        void changeKey(false);
      }),
    );
  if (deleteKey)
    disposers.push(
      createListenerDisposer(deleteKey, "click", () => {
        void changeKey(true);
      }),
    );
  void refreshKeyStatus();
  return composeDisposables(...disposers, ollamaDisposer, () => {
    disposed = true;
    cancelRequests();
  });
}

function handleTestConnection(
  providerMenulist: MenulistLike,
  endpointInput: HTMLInputElement,
  modelMenulist: MenulistLike,
  modelTextInput: HTMLInputElement,
  keyInput: HTMLInputElement,
  button: HTMLButtonElement,
  getSignal: () => AbortSignal,
): () => void {
  return () => {
    if (button.disabled) return;
    button.disabled = true;
    const signal = getSignal();
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
      const key =
        keyInput.value.trim() ||
        (await getAiApiKeyForProvider(selectedId, policy.endpoint));
      if (signal.aborted) return;

      button.disabled = true;
      try {
        const result = await runAiConnectionProbe({
          url: policy.endpoint,
          apiKey: key,
          apiKeyRequired: policy.apiKeyRequired,
          model,
          includeJsonObjectResponseFormat: false,
          httpPost: (url, options) =>
            zoteroProbeHttpPost(url, { ...options, signal }),
        });
        if (signal.aborted) return;
        showAutoTagPrefsToast(
          result.ok
            ? getString("pref-ai-test-connection-ok")
            : formatProbeMessage(result.message),
        );
      } finally {
        button.disabled = false;
      }
    })()
      .catch(() => {
        if (!signal.aborted) showAutoTagPrefsToast(getString("pref-key-error"));
      })
      .finally(() => {
        button.disabled = false;
      });
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
