import { config } from "../../package.json";
import { normalizeExtensionList } from "../modules/copy/attachmentTypes";
import type { MultiAttachmentMode } from "../modules/copy/types";

type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];

const PREFS_PREFIX = config.prefsPrefix;

export interface AiProviderModel {
  value: string;
  label: string;
}

export type AiModelSource =
  | "static"
  | "ollama-dynamic"
  | "lmstudio-dynamic"
  | "free-text";

export interface AiProviderConfig {
  id: string;
  label: string;
  endpoint: string;
  models: AiProviderModel[];
  modelSource: AiModelSource;
  apiKeyRequired: boolean;
  apiKeyPlaceholder?: string;
  endpointEditable: boolean;
}

export const AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    models: [
      { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
    ],
    modelSource: "static",
    apiKeyRequired: true,
    endpointEditable: false,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek Chat v3" },
      { value: "deepseek/deepseek-r1", label: "DeepSeek R1" },
      { value: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B" },
      { value: "google/gemma-3-12b-it", label: "Gemma 3 12B" },
    ],
    modelSource: "static",
    apiKeyRequired: true,
    endpointEditable: false,
  },
  {
    id: "ollama",
    label: "Ollama",
    endpoint: "http://localhost:11434",
    models: [],
    modelSource: "ollama-dynamic",
    apiKeyRequired: false,
    apiKeyPlaceholder: "pref-ollama-api-key-placeholder",
    endpointEditable: true,
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    endpoint: "http://localhost:1234",
    models: [],
    modelSource: "lmstudio-dynamic",
    apiKeyRequired: false,
    apiKeyPlaceholder: "pref-lmstudio-api-key-placeholder",
    endpointEditable: true,
  },
  {
    id: "custom",
    label: "Custom",
    endpoint: "",
    models: [],
    modelSource: "free-text",
    apiKeyRequired: true,
    endpointEditable: true,
  },
];

export const DEFAULT_AI_PROMPT = `You are a research assistant. From the paper title and abstract, propose short tags.

Rules:
- Output between 3 and 5 tags inclusive. Use the smallest count in that range that still characterizes the paper well; do not add marginal or duplicate tags just to reach five.
- Write tags in {language} for ordinary words. Keep common English technical terms as-is when they are standard in the field (e.g. Transformer, CRISPR, CNN).
- If the title or abstract uses a well-known abbreviation for a method or concept, prefer that short form over the full name when it is the natural tag.
- Cover topics, methods, and research area. Return ONLY JSON: {"tags":["tag1","tag2",...]}

Title: {title}
Abstract: {abstract}`;

/**
 * Get preference value.
 * Wrapper of `Zotero.Prefs.get`.
 * @param key
 */
export function getPref<K extends keyof PluginPrefsMap>(key: K) {
  return Zotero.Prefs.get(`${PREFS_PREFIX}.${key}`, true) as PluginPrefsMap[K];
}

/**
 * Set preference value.
 * Wrapper of `Zotero.Prefs.set`.
 * @param key
 * @param value
 */
export function setPref<K extends keyof PluginPrefsMap>(
  key: K,
  value: PluginPrefsMap[K],
) {
  return Zotero.Prefs.set(`${PREFS_PREFIX}.${key}`, value, true);
}

export function getMultiAttachmentMode(): MultiAttachmentMode {
  const value = getPref("multiAttachmentMode");
  return value === "primary" ? "primary" : "all";
}

export function getLibraryShortcut(): string {
  return (getPref("libraryShortcut") || "Ctrl+C").trim();
}

export function getReaderShortcut(): string {
  return (getPref("readerShortcut") || "").trim();
}

export function getMainToolbarButtonEnabled(): boolean {
  const value = getPref("showMainToolbarButton");
  return value !== false;
}

export function getReaderToolbarButtonEnabled(): boolean {
  const value = getPref("showReaderToolbarButton");
  return value !== false;
}

export function getContextMenuEntryEnabled(): boolean {
  const value = getPref("showContextMenuEntry");
  return value !== false;
}

export function getEnabledAttachmentTypes(): string[] {
  return normalizeExtensionList(getPref("enabledAttachmentTypes") || "");
}

export function getCustomAttachmentTypes(): string[] {
  return normalizeExtensionList(getPref("customAttachmentTypes") || "");
}

export function getAutoTaggingEnabled(): boolean {
  const value = getPref("autoTaggingEnabled");
  return value !== false;
}

export function getAiProvider(): string {
  return (getPref("aiProvider") || "deepseek").trim();
}

export function getAiApiEndpoint(): string {
  return (getPref("aiApiEndpoint") || "").trim();
}

/**
 * Many OpenAI-compatible hosts document only the API base (e.g. …/v1).
 * Chat calls must POST to …/v1/chat/completions.
 */
export function normalizeOpenAiChatCompletionsUrl(url: string): string {
  const t = url.trim().replace(/\/+$/, "");
  if (!t) return "";
  if (t.toLowerCase().endsWith("/chat/completions")) {
    return t;
  }
  return `${t}/chat/completions`;
}

export function normalizeOllamaBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function buildOllamaChatCompletionsUrl(baseUrl: string): string {
  const base = normalizeOllamaBaseUrl(baseUrl);
  return base ? `${base}/v1/chat/completions` : "";
}

type PrefKey = keyof PluginPrefsMap;

const PROVIDER_ENDPOINT_PREFS: Record<
  string,
  { pref: PrefKey; fallback: string }
> = {
  ollama: { pref: "aiEndpointOllama", fallback: "http://localhost:11434" },
  lmstudio: { pref: "aiEndpointLmstudio", fallback: "http://localhost:1234" },
};

export function getProviderEndpointForUi(providerId: string): string {
  const entry = PROVIDER_ENDPOINT_PREFS[providerId];
  if (entry) {
    return String(getPref(entry.pref) || entry.fallback).trim();
  }
  if (providerId === "custom") {
    return getAiApiEndpoint();
  }
  return getAiProviderConfig(providerId).endpoint;
}

export function setProviderEndpointFromUi(
  providerId: string,
  endpointValue: string,
): void {
  const normalized = endpointValue.trim();
  const entry = PROVIDER_ENDPOINT_PREFS[providerId];
  if (entry) {
    setPref(entry.pref, normalized);
    return;
  }
  if (providerId === "custom") {
    setPref("aiApiEndpoint", normalized);
  }
}

const PROVIDER_API_KEY_PREFS: Record<
  string,
  | "aiApiKeyDeepseek"
  | "aiApiKeyOpenrouter"
  | "aiApiKeyOllama"
  | "aiApiKeyLmstudio"
  | "aiApiKeyCustom"
> = {
  deepseek: "aiApiKeyDeepseek",
  openrouter: "aiApiKeyOpenrouter",
  ollama: "aiApiKeyOllama",
  lmstudio: "aiApiKeyLmstudio",
  custom: "aiApiKeyCustom",
};

export function getAiApiKeyForProvider(providerId: string): string {
  const key = PROVIDER_API_KEY_PREFS[providerId];
  if (!key) return "";
  return (getPref(key) || "").trim();
}

export function setAiApiKeyForProvider(
  providerId: string,
  value: string,
): void {
  const key = PROVIDER_API_KEY_PREFS[providerId];
  if (key) {
    setPref(key, value);
  }
}

export function getAiModel(): string {
  return (getPref("aiModel") || "").trim();
}

/**
 * Model id shown for Ollama in prefs: current `aiModel`, or last remembered Ollama model.
 */
export function getOllamaModelForUi(): string {
  return getLastModelForProvider("aiLastModelOllama");
}

/**
 * Model id for Custom provider UI and API: current `aiModel`, or last remembered.
 */
export function getCustomModelForUi(): string {
  return getLastModelForProvider("aiLastModelCustom");
}

/** Last model explicitly used with LM Studio (survives switching to other providers). */
export function getLmStudioModelForUi(): string {
  return getLastModelForProvider("aiLastModelLmstudio");
}

function getLastModelForProvider(
  lastModelPref:
    | "aiLastModelOllama"
    | "aiLastModelLmstudio"
    | "aiLastModelCustom",
): string {
  const current = getAiModel();
  if (current) return current;
  return (getPref(lastModelPref) || "").trim();
}

const AI_DYNAMIC_PROVIDER_LAST_MODEL_PREFS: Record<
  string,
  "aiLastModelOllama" | "aiLastModelLmstudio" | "aiLastModelCustom"
> = {
  ollama: "aiLastModelOllama",
  lmstudio: "aiLastModelLmstudio",
  custom: "aiLastModelCustom",
};

export function restoreAiModelForDynamicProviderIfEmpty(
  providerId: string,
): void {
  const pref = AI_DYNAMIC_PROVIDER_LAST_MODEL_PREFS[providerId];
  if (!pref) return;
  const remembered = (getPref(pref) || "").trim();
  if (remembered && !getAiModel()) {
    setPref("aiModel", remembered);
  }
}

export function getAiPrompt(): string {
  const value = (getPref("aiPrompt") || "").trim();
  return value || DEFAULT_AI_PROMPT;
}

export function getAiProviderConfig(id: string): AiProviderConfig {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

/**
 * Pick a valid model id for a provider.
 * For static providers, fall back to the first listed model.
 * For dynamic/free-text providers, return the pref value as-is.
 */
export function resolveModelForAiProvider(
  config: AiProviderConfig,
  prefModel: string,
): string {
  const m = prefModel.trim();
  if (config.modelSource !== "static") {
    return m;
  }
  if (config.models.some((x) => x.value === m)) {
    return m;
  }
  return config.models[0]?.value ?? "";
}

/** When leaving Ollama or Custom, remember the current model id for that provider. */
export function persistAiModelForDynamicProviderIfLeaving(
  providerId: string,
): void {
  const pref = AI_DYNAMIC_PROVIDER_LAST_MODEL_PREFS[providerId];
  if (!pref) return;
  const m = getAiModel().trim();
  if (m) setPref(pref, m);
}

/**
 * Call after `aiProvider` is saved. Resets `aiModel` so it matches the new provider
 * (static: clamp the previous id to the new list; Ollama/Custom: restore last id).
 */
export function reconcileAiModelForProvider(targetProviderId: string): void {
  const config = getAiProviderConfig(targetProviderId);
  if (config.modelSource === "static") {
    setPref("aiModel", resolveModelForAiProvider(config, getAiModel()));
    return;
  }
  const lastPref = AI_DYNAMIC_PROVIDER_LAST_MODEL_PREFS[targetProviderId];
  if (lastPref) {
    setPref("aiModel", (getPref(lastPref) || "").trim());
  }
}

/** Model id to send to the API (clamped to the current provider list). */
export function getEffectiveAiModel(): string {
  const config = getAiProviderConfig(getAiProvider());
  if (config.modelSource === "static") {
    return resolveModelForAiProvider(config, getAiModel());
  }
  const lastModelPref =
    config.modelSource === "ollama-dynamic"
      ? "aiLastModelOllama"
      : config.modelSource === "lmstudio-dynamic"
        ? "aiLastModelLmstudio"
        : "aiLastModelCustom";
  return getLastModelForProvider(lastModelPref);
}

export function getStripConnectorTags(): boolean {
  return getPref("stripConnectorTags") === true;
}

export function getAutoTagOnAdd(): boolean {
  return getPref("autoTagOnAdd") === true;
}

export function getAllowedAttachmentTypes(): string[] {
  return normalizeExtensionList([
    ...getEnabledAttachmentTypes(),
    ...getCustomAttachmentTypes(),
  ]);
}
