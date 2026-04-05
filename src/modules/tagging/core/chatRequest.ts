export interface BuildChatRequestBodyArgs {
  model: string;
  userMessage: string;
  maxTokens?: number;
  includeJsonObjectResponseFormat: boolean;
}

/**
 * Build an OpenAI-compatible chat/completions payload.
 * Optional fields are only included when explicitly requested so providers
 * with stricter schemas can still be supported.
 */
export function buildChatRequestBody(args: BuildChatRequestBodyArgs): string {
  const body: {
    model: string;
    messages: Array<{ role: "user"; content: string }>;
    max_tokens?: number;
    response_format?: { type: "json_object" };
  } = {
    model: args.model,
    messages: [{ role: "user", content: args.userMessage }],
  };

  if (typeof args.maxTokens === "number") {
    body.max_tokens = args.maxTokens;
  }
  if (args.includeJsonObjectResponseFormat) {
    body.response_format = { type: "json_object" };
  }

  return JSON.stringify(body);
}
