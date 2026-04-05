import {
  buildOllamaChatCompletionsUrl,
  getAiProviderConfig,
  normalizeOpenAiChatCompletionsUrl,
} from "../../../utils/prefs";

export interface ProviderRequestPolicy {
  includeJsonObjectResponseFormat: boolean;
}

export interface ProviderRuntimePolicy {
  providerId: string;
  endpoint: string;
  apiKeyRequired: boolean;
  request: ProviderRequestPolicy;
}

function shouldIncludeJsonObjectResponseFormat(providerId: string): boolean {
  // Ollama's OpenAI-compatible APIs may reject response_format depending on
  // model/runtime version, so default to a minimal request there.
  return providerId !== "ollama";
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
  if (providerId === "custom") {
    return normalizeOpenAiChatCompletionsUrl(endpointOverride ?? "");
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
    request: {
      includeJsonObjectResponseFormat: shouldIncludeJsonObjectResponseFormat(
        config.id,
      ),
    },
  };
}
