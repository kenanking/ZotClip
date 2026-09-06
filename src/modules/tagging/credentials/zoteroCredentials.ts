import { config } from "../../../../package.json";
import { resolveProviderEndpoint } from "../core/providerAdapter";
import { createCredentialStore, credentialIdentity } from "./credentialStore";

const ORIGIN = "chrome://zotclip";
const legacyPrefs: Record<string, string> = {
  deepseek: "aiApiKeyDeepseek",
  openrouter: "aiApiKeyOpenrouter",
  ollama: "aiApiKeyOllama",
  lmstudio: "aiApiKeyLmstudio",
  custom: "aiApiKeyCustom",
};
async function find(identity: string): Promise<nsILoginInfo[]> {
  await Services.logins.initializationPromise;
  return Services.logins.findLogins(ORIGIN, "", identity);
}
const store = createCredentialStore({
  async read(identity) {
    return (await find(identity))[0]?.password ?? "";
  },
  async write(identity, value) {
    const previous = await find(identity);
    const login = (
      Components.classes as unknown as Record<
        string,
        { createInstance(iid: nsIID): nsILoginInfo }
      >
    )["@mozilla.org/login-manager/loginInfo;1"].createInstance(
      Components.interfaces.nsILoginInfo,
    );
    login.init(
      ORIGIN,
      null as unknown as string,
      identity,
      config.addonID,
      value,
      "",
      "",
    );
    if (previous[0]) Services.logins.modifyLogin(previous[0], login);
    else await Services.logins.addLoginAsync(login);
  },
  async remove(identity) {
    for (const login of await find(identity))
      Services.logins.removeLogin(login);
  },
});

export async function migrateAiCredentials(): Promise<void> {
  const results = await Promise.allSettled(
    Object.entries(legacyPrefs).map(async ([provider, pref]) => {
      const name = `${config.prefsPrefix}.${pref}`;
      const legacy = String(Zotero.Prefs.get(name, true) || "").trim();
      if (!legacy) return;
      // Freeze migration destination even if the user later edits the endpoint after a failed attempt.
      const destinationPref = `${name}MigrationIdentity`;
      const identity = String(
        Zotero.Prefs.get(destinationPref, true) ||
          credentialIdentity(provider, resolveProviderEndpoint(provider)),
      );
      Zotero.Prefs.set(destinationPref, identity, true);
      await store.migrate(identity, legacy, () => {
        Zotero.Prefs.clear(name, true);
        Zotero.Prefs.clear(destinationPref, true);
      });
    }),
  );
  if (results.some((result) => result.status === "rejected"))
    throw new Error("Credential migration failed");
}
export function getAiApiKeyForProvider(
  provider: string,
  endpoint = resolveProviderEndpoint(provider),
): Promise<string> {
  return store.read(credentialIdentity(provider, endpoint));
}
export function setAiApiKeyForProvider(
  provider: string,
  value: string,
  endpoint = resolveProviderEndpoint(provider),
): Promise<void> {
  return store.write(credentialIdentity(provider, endpoint), value.trim());
}
