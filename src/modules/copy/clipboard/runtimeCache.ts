import type { PlatformContext } from "./platformDetection";

export interface ClipboardRuntimeCache {
  getPlatformContext(resolve: () => PlatformContext): PlatformContext;
  getCommandAvailability(
    command: string,
    probe: () => Promise<boolean>,
  ): Promise<boolean>;
  getLinuxGtkAvailability(probe: () => Promise<boolean>): Promise<boolean>;
  invalidateCommandAvailability(command: string): void;
  invalidateLinuxGtkAvailability(): void;
  invalidatePlatformContext(): void;
  invalidateAll(): void;
}

export function createClipboardRuntimeCache(): ClipboardRuntimeCache {
  let platformContext: PlatformContext | undefined;
  const commandAvailability = new Map<string, Promise<boolean>>();
  let linuxGtkAvailability: Promise<boolean> | undefined;

  return {
    getPlatformContext(resolve): PlatformContext {
      platformContext ||= resolve();
      return platformContext;
    },

    getCommandAvailability(
      command: string,
      probe: () => Promise<boolean>,
    ): Promise<boolean> {
      let cachedProbe = commandAvailability.get(command);
      if (!cachedProbe) {
        cachedProbe = probe();
        commandAvailability.set(command, cachedProbe);
      }

      return cachedProbe;
    },

    getLinuxGtkAvailability(probe: () => Promise<boolean>): Promise<boolean> {
      linuxGtkAvailability ||= probe();
      return linuxGtkAvailability;
    },

    invalidateCommandAvailability(command: string): void {
      commandAvailability.delete(command);
    },

    invalidateLinuxGtkAvailability(): void {
      linuxGtkAvailability = undefined;
    },

    invalidatePlatformContext(): void {
      platformContext = undefined;
    },

    invalidateAll(): void {
      platformContext = undefined;
      commandAvailability.clear();
      linuxGtkAvailability = undefined;
    },
  };
}

const defaultClipboardRuntimeCache = createClipboardRuntimeCache();

export function getClipboardRuntimeCache(): ClipboardRuntimeCache {
  return defaultClipboardRuntimeCache;
}
