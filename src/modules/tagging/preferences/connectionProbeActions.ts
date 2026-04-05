import { getString } from "../../../utils/locale";
import { showAutoTagToast } from "../integration/autoTagNotify";

export async function zoteroProbeHttpPost(
  url: string,
  options: {
    headers: Record<string, string>;
    body: string;
    timeout: number;
  },
): Promise<{ response: string; status: number }> {
  try {
    const r: any = await Zotero.HTTP.request("POST", url, {
      headers: options.headers,
      body: options.body,
      timeout: options.timeout,
    });
    return {
      response: r.responseText ?? "",
      status: typeof r.status === "number" ? r.status : 200,
    };
  } catch (e: any) {
    const text =
      e?.responseText ??
      e?.xmlhttp?.responseText ??
      (e instanceof Error ? e.message : String(e));
    const status =
      typeof e?.status === "number"
        ? e.status
        : typeof e?.xmlhttp?.status === "number"
          ? e.xmlhttp.status
          : 0;
    return { response: String(text), status };
  }
}

export function formatProbeMessage(failureMessage: string): string {
  switch (failureMessage) {
    case "__needs_endpoint__":
      return getString("pref-ai-test-connection-needs-endpoint");
    case "__needs_key__":
      return getString("pref-ai-test-connection-needs-key");
    case "__needs_model__":
      return getString("pref-ai-test-connection-needs-model");
    default:
      return getString("pref-ai-test-connection-fail", {
        args: { error: failureMessage },
      });
  }
}

export function showAutoTagPrefsToast(text: string): void {
  showAutoTagToast(text, 3500);
}
