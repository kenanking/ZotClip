import { zoteroAutoTagHttpRequest } from "../core/zoteroAutoTagDeps";
import { getString } from "../../../utils/locale";
import { PROBE_SENTINEL } from "./aiConnectionProbe";

export async function zoteroProbeHttpPost(
  url: string,
  options: {
    headers: Record<string, string>;
    body: string;
    timeout: number;
    signal?: AbortSignal;
  },
): Promise<{ response: string; status: number }> {
  const r = await zoteroAutoTagHttpRequest(url, { ...options, method: "POST" });
  return { response: r.response, status: 200 };
}

export function formatProbeMessage(failureMessage: string): string {
  switch (failureMessage) {
    case PROBE_SENTINEL.NEEDS_ENDPOINT:
      return getString("pref-ai-test-connection-needs-endpoint");
    case PROBE_SENTINEL.NEEDS_KEY:
      return getString("pref-ai-test-connection-needs-key");
    case PROBE_SENTINEL.NEEDS_MODEL:
      return getString("pref-ai-test-connection-needs-model");
    default:
      return getString("pref-ai-test-connection-fail", {
        args: { error: failureMessage },
      });
  }
}
