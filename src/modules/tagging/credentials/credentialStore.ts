export interface CredentialBackend {
  read(identity: string): Promise<string>;
  write(identity: string, value: string): Promise<void>;
  remove(identity: string): Promise<void>;
}

export function credentialIdentity(provider: string, endpoint: string): string {
  const url = new URL(endpoint);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid AI endpoint");
  }
  return `${provider}|${url.origin}`;
}

/** Serialize per identity so migration, replace and delete cannot overwrite each other. */
export function createCredentialStore(backend: CredentialBackend) {
  const pending = new Map<string, Promise<unknown>>();
  function exclusive<T>(identity: string, work: () => Promise<T>): Promise<T> {
    const operation = (pending.get(identity) ?? Promise.resolve())
      .catch(() => {})
      .then(work);
    pending.set(identity, operation);
    void operation
      .finally(() => {
        if (pending.get(identity) === operation) pending.delete(identity);
      })
      .catch(() => {});
    return operation;
  }
  return {
    read: (identity: string) =>
      exclusive(identity, () => backend.read(identity)),
    write: (identity: string, value: string) =>
      exclusive(identity, async () => {
        if (value) {
          await backend.write(identity, value);
          if ((await backend.read(identity)) !== value)
            throw new Error("Credential verification failed");
        } else await backend.remove(identity);
      }),
    migrate: (identity: string, legacy: string, clear: () => void) =>
      exclusive(identity, async () => {
        if (!legacy) return;
        const saved = await backend.read(identity);
        if (!saved) {
          await backend.write(identity, legacy);
          if ((await backend.read(identity)) !== legacy)
            throw new Error("Credential migration verification failed");
        }
        clear();
      }),
  };
}
