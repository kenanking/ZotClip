import {
  buildOllamaChatCompletionsUrl,
  getAiProviderConfig,
  getProviderEndpointForUi,
  normalizeOpenAiChatCompletionsUrl,
} from "../../../utils/prefs";

export interface ProviderRuntimePolicy {
  providerId: string;
  endpoint: string;
  apiKeyRequired: boolean;
  includeJsonObjectResponseFormat: boolean;
}

function buildLmStudioChatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  return base ? `${base}/v1/chat/completions` : "";
}

type EndpointBuilder = (baseUrl: string) => string;

const PROVIDER_ENDPOINT_BUILDERS: Record<string, EndpointBuilder> = {
  ollama: buildOllamaChatCompletionsUrl,
  lmstudio: buildLmStudioChatCompletionsUrl,
  custom: normalizeOpenAiChatCompletionsUrl,
};

const RELAXED_JSON_MODE_PROVIDERS = new Set(["ollama", "lmstudio", "custom"]);

export function resolveProviderEndpoint(
  providerId: string,
  endpointOverride?: string,
): string {
  const config = getAiProviderConfig(providerId);
  const builder = PROVIDER_ENDPOINT_BUILDERS[providerId];
  if (builder) {
    // Without an explicit override (the real tagging path), fall back to the
    // user-configured endpoint pref. getProviderEndpointForUi already handles
    // ollama/lmstudio prefs, custom's aiApiEndpoint, and static defaults.
    const baseUrl = endpointOverride ?? getProviderEndpointForUi(providerId);
    return builder(baseUrl);
  }
  return config.endpoint;
}

export function resolveProviderRuntimePolicy(args: {
  providerId: string;
  endpointOverride?: string;
}): ProviderRuntimePolicy {
  const config = getAiProviderConfig(args.providerId);
  return {
    providerId: config.id,
    endpoint: resolveProviderEndpoint(config.id, args.endpointOverride),
    apiKeyRequired: config.apiKeyRequired,
    includeJsonObjectResponseFormat: !RELAXED_JSON_MODE_PROVIDERS.has(
      config.id,
    ),
  };
}
