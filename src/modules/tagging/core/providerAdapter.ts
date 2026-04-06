import {
  buildOllamaChatCompletionsUrl,
  getAiApiEndpoint,
  getAiProviderConfig,
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

export function resolveProviderEndpoint(
  providerId: string,
  endpointOverride?: string,
): string {
  const config = getAiProviderConfig(providerId);
  if (providerId === "ollama") {
    return buildOllamaChatCompletionsUrl(
      endpointOverride ?? config.endpoint ?? "",
    );
  }
  if (providerId === "lmstudio") {
    return buildLmStudioChatCompletionsUrl(
      endpointOverride ?? config.endpoint ?? "",
    );
  }
  if (providerId === "custom") {
    return normalizeOpenAiChatCompletionsUrl(
      endpointOverride ?? getAiApiEndpoint(),
    );
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
    includeJsonObjectResponseFormat:
      config.id !== "ollama" &&
      config.id !== "lmstudio" &&
      config.id !== "custom",
  };
}
