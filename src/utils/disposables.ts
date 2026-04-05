export interface DisposableHandle {
  dispose(): void;
}

export function createNoopHandle(): DisposableHandle {
  return {
    dispose(): void {},
  };
}

export function createListenerDisposer(
  target: EventTarget,
  type: string,
  listener: EventListener,
  options?: boolean | AddEventListenerOptions,
): () => void {
  target.addEventListener(type, listener, options);

  let disposed = false;

  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    target.removeEventListener(type, listener, options);
  };
}

export function composeDisposables(
  ...callbacks: Array<(() => void) | undefined>
): DisposableHandle {
  let disposed = false;

  return {
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;

      for (const callback of callbacks) {
        callback?.();
      }
    },
  };
}
