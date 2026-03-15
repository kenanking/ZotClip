import type { DisposableHandle } from "../ui/disposables";

interface KeyboardEventOptionsLike {
  type: "keydown" | "keyup";
}

type KeyboardRegistryCallback = (
  event: KeyboardEvent,
  options: KeyboardEventOptionsLike,
) => void;

export function createKeyboardRegistry(deps: {
  register(callback: KeyboardRegistryCallback): void;
  unregister(callback: KeyboardRegistryCallback): void;
  onLibraryShortcut(event: KeyboardEvent): Promise<boolean> | boolean;
  onReaderShortcut(event: KeyboardEvent): Promise<boolean> | boolean;
}): {
  start(): DisposableHandle;
} {
  const callback: KeyboardRegistryCallback = (event, options) => {
    if (options.type !== "keydown") {
      return;
    }

    void deps.onLibraryShortcut(event);
    void deps.onReaderShortcut(event);
  };

  return {
    start(): DisposableHandle {
      deps.register(callback);
      return {
        dispose(): void {
          deps.unregister(callback);
        },
      };
    },
  };
}
