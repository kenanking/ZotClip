import { parseAutoTagResponse } from "./responseParser";
import { buildChatRequestBody } from "./chatRequest";
import type { AutoTagResult, AutoTagServiceDeps } from "./types";

export async function autoTagItem(
  item: Zotero.Item,
  deps: AutoTagServiceDeps,
): Promise<AutoTagResult> {
  const title = item.getField("title") as string;
  const abstract = (item.getField("abstractNote") as string) || "";

  if (!title?.trim()) {
    return { kind: "skipped", reason: "noTitle" };
  }

  const apiKey = deps.getApiKey();
  if (!apiKey && deps.isApiKeyRequired()) {
    return { kind: "skipped", reason: "noApiKey" };
  }

  deps.onProgress({ phase: "start", text: "", progress: 10 });

  const prompt = deps.getPrompt(title, abstract);

  const body = buildChatRequestBody({
    model: deps.getModel(),
    userMessage: prompt,
    includeJsonObjectResponseFormat:
      deps.getRequestOptions().includeJsonObjectResponseFormat,
  });

  deps.onProgress({ phase: "calling", text: "", progress: 30 });

  let responseText: string;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const result = await deps.httpRequest(deps.getEndpoint(), {
      method: "POST",
      headers,
      body,
    });
    responseText = result.response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.onProgress({
      phase: "error",
      text: message,
      progress: 100,
    });
    return { kind: "failed", message };
  }

  deps.onProgress({ phase: "calling", text: "", progress: 70 });

  let parsed: { tags: string[] };
  try {
    const json = JSON.parse(responseText);
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response content");
    }
    parsed = parseAutoTagResponse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Invalid AI response format: ${detail}`;
    console.error("[ZotClip] Failed to parse AI response:", error);
    deps.onProgress({
      phase: "error",
      text: message,
      progress: 100,
    });
    return { kind: "failed", message };
  }

  const existingTags = new Set(
    item.getTags().map((t: { tag: string }) => t.tag.toLowerCase()),
  );

  const uniqueNewTags: string[] = [];
  for (const tag of parsed.tags) {
    const lower = tag.toLowerCase();
    if (!existingTags.has(lower)) {
      existingTags.add(lower);
      uniqueNewTags.push(tag);
    }
  }

  if (uniqueNewTags.length === 0) {
    deps.onProgress({
      phase: "done",
      text: "",
      progress: 100,
    });
    return { kind: "ok", tagsAdded: [] };
  }

  for (const tag of uniqueNewTags) {
    item.addTag(tag, 0);
  }
  await item.saveTx();

  deps.onProgress({
    phase: "done",
    text: uniqueNewTags.join(", "),
    progress: 100,
  });

  return { kind: "ok", tagsAdded: uniqueNewTags };
}
