import { getAiApiKeyForProvider } from "../credentials/zoteroCredentials";
import type { AutoTagProgress, AutoTagServiceDeps } from "./types";
import {
  fillAiPromptTemplate,
  getAiPromptLanguageLabel,
} from "./promptTemplate";
import {
  getAiPrompt,
  getAiProvider,
  getEffectiveAiModel,
} from "../../../utils/prefs";
import { resolveProviderRuntimePolicy } from "./providerAdapter";

/** Default timeout for AI tag requests (120s), longer than Zotero's HTTP default (30s). */
const HTTP_TIMEOUT_MS = 120_000;

export async function zoteroAutoTagHttpRequest(
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body: string;
    timeout: number;
    signal?: AbortSignal;
  },
): Promise<{ response: string }> {
  options.signal?.throwIfAborted();
  let request: XMLHttpRequest | undefined;
  const abort = () => request?.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await Zotero.HTTP.request(options.method, url, {
      headers: options.headers,
      body: options.body,
      timeout: options.timeout,
      requestObserver: (xhr: XMLHttpRequest) => {
        request = xhr;
        if (options.signal?.aborted) xhr.abort();
      },
    });
    options.signal?.throwIfAborted();
    if (response.status < 200 || response.status >= 300)
      throw new Error(`HTTP ${response.status}`);
    return { response: response.responseText ?? "" };
  } finally {
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function createZoteroAutoTagDeps(
  onProgress: (update: AutoTagProgress) => void,
  options: { signal?: AbortSignal; itemID?: number; manual?: boolean } = {},
): Promise<AutoTagServiceDeps> {
  const providerId = getAiProvider();
  const policy = resolveProviderRuntimePolicy({ providerId });
  const model = getEffectiveAiModel();
  const template = getAiPrompt();
  const language = getAiPromptLanguageLabel();
  const apiKey = await getAiApiKeyForProvider(providerId, policy.endpoint);
  options.signal?.throwIfAborted();
  return {
    signal: options.signal,
    canWrite:
      options.itemID === undefined
        ? undefined
        : async () => {
            const item = await Zotero.Items.getAsync(options.itemID!);
            return Boolean(
              item &&
              !item.deleted &&
              item.isRegularItem() &&
              item.isEditable(),
            );
          },
    saveItem: async (item) => {
      options.signal?.throwIfAborted();
      const supportsUndo = Number.parseInt(Zotero.version, 10) >= 10;
      return item.saveTx(
        options.manual && supportsUndo
          ? ({
              undoAction: "undo-action-edit-metadata",
              undoActionArgs: { count: 1 },
            } as Parameters<Zotero.Item["saveTx"]>[0])
          : undefined,
      );
    },
    getEndpoint: () => policy.endpoint,
    getApiKey: () => apiKey,
    isApiKeyRequired: () => policy.apiKeyRequired,
    getModel: () => model,
    getTimeout: () => HTTP_TIMEOUT_MS,
    getRequestOptions: () => ({
      includeJsonObjectResponseFormat: policy.includeJsonObjectResponseFormat,
    }),
    getPrompt: (title, abstract) =>
      fillAiPromptTemplate(template, { title, abstract, language }),
    onProgress,
    httpRequest: (url, requestOptions) =>
      zoteroAutoTagHttpRequest(url, {
        ...requestOptions,
        signal: options.signal,
      }),
  };
}
