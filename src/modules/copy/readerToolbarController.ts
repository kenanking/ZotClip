export interface ReaderToolbarControllerDeps {
  isEnabled(): boolean;
  registerReaderToolbarCopyButton(): () => void;
}

export interface ReaderToolbarController {
  sync(): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export function createReaderToolbarController(
  deps: ReaderToolbarControllerDeps,
): ReaderToolbarController {
  let disposeRegisteredButton: (() => void) | null = null;
  let enabledOverride: boolean | undefined;

  const isEnabled = (): boolean => enabledOverride ?? deps.isEnabled();

  return {
    sync(): void {
      if (isEnabled()) {
        disposeRegisteredButton ||= deps.registerReaderToolbarCopyButton();
        return;
      }

      disposeRegisteredButton?.();
      disposeRegisteredButton = null;
    },

    setEnabled(enabled: boolean): void {
      enabledOverride = enabled;
      this.sync();
    },

    dispose(): void {
      disposeRegisteredButton?.();
      disposeRegisteredButton = null;
    },
  };
}
