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
  return { response: response.responseText ?? "" };
}

export function createZoteroAutoTagDeps(
  onProgress: (update: AutoTagProgress) => void,
): AutoTagServiceDeps {
  const providerId = getAiProvider();
  const policy = resolveProviderRuntimePolicy({ providerId });
  return {
    getEndpoint: () => policy.endpoint,
    getApiKey: () => {
      const key = getAiApiKeyForProvider(providerId);
      // Ollama does not require an API key — return a placeholder so
      // autoTagService's empty-key guard doesn't skip the request.
      if (!policy.apiKeyRequired && !key) return "ollama-no-key";
      return key;
    },
    getModel: getEffectiveAiModel,
    getRequestOptions: () => ({
      includeJsonObjectResponseFormat:
        policy.request.includeJsonObjectResponseFormat,
    }),
    getPrompt: buildPrompt,
    onProgress,
    httpRequest: zoteroAutoTagHttpRequest,
  };
}
