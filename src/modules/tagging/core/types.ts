export type AutoTagResult =
  | { kind: "ok"; tagsAdded: string[] }
  | { kind: "skipped"; reason: "noTitle" | "noApiKey" }
  | { kind: "failed"; message: string };

export interface AutoTagProgress {
  phase: "start" | "calling" | "done" | "error";
  text: string;
  progress: number;
}

export interface AutoTagServiceDeps {
  getEndpoint(): string;
  getApiKey(): string;
  isApiKeyRequired(): boolean;
  getModel(): string;
  getTimeout(): number;
  getRequestOptions(): {
    includeJsonObjectResponseFormat: boolean;
  };
  getPrompt(title: string, abstract: string): string;
  onProgress(update: AutoTagProgress): void;
  httpRequest(
    url: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body: string;
      timeout: number;
    },
  ): Promise<{ response: string }>;
}
