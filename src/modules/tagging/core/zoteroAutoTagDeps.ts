import type { AutoTagProgress, AutoTagServiceDeps } from "./types";
import {
  fillAiPromptTemplate,
  getAiPromptLanguageLabel,
} from "./promptTemplate";
import {
  getAiApiKeyForProvider,
  getAiPrompt,
  getAiProvider,
  getEffectiveAiModel,
} from "../../../utils/prefs";
import { resolveProviderRuntimePolicy } from "./providerAdapter";

function buildPrompt(title: string, abstract: string): string {
  const template = getAiPrompt();
  return fillAiPromptTemplate(template, {
    title,
    abstract,
    language: getAiPromptLanguageLabel(),
  });
}

/** Longer than Zotero's HTTP default (30s) so slow LLM completions can finish. */
const HTTP_TIMEOUT_MS = 120_000;

export async function zoteroAutoTagHttpRequest(
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
): Promise<{ response: string }> {
  const response = await Zotero.HTTP.request(options.method, url, {
    headers: options.headers,
    body: options.body,
    timeout: HTTP_TIMEOUT_MS,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `HTTP ${response.status}: ${response.responseText?.slice(0, 200) ?? "no body"}`,
    );
  }
  return { response: response.responseText ?? "" };
}

export function createZoteroAutoTagDeps(
  onProgress: (update: AutoTagProgress) => void,
): AutoTagServiceDeps {
  const providerId = getAiProvider();
  const policy = resolveProviderRuntimePolicy({ providerId });
  return {
    getEndpoint: () => policy.endpoint,
    getApiKey: () => getAiApiKeyForProvider(providerId),
    isApiKeyRequired: () => policy.apiKeyRequired,
    getModel: getEffectiveAiModel,
    getRequestOptions: () => ({
      includeJsonObjectResponseFormat: policy.includeJsonObjectResponseFormat,
    }),
    getPrompt: buildPrompt,
    onProgress,
    httpRequest: zoteroAutoTagHttpRequest,
  };
}
