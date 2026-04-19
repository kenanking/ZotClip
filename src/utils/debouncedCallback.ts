export function createDebouncedCallback(
  callback: () => void,
  delayMs: number,
): {
  trigger(): void;
  cancel(): void;
} {
  let timeoutID: ReturnType<typeof setTimeout> | undefined;

  return {
    trigger(): void {
      if (timeoutID !== undefined) {
        clearTimeout(timeoutID);
      }

      timeoutID = setTimeout(() => {
        timeoutID = undefined;
        callback();
      }, delayMs);
    },
    cancel(): void {
      if (timeoutID === undefined) {
        return;
      }

      clearTimeout(timeoutID);
      timeoutID = undefined;
    },
  };
}
