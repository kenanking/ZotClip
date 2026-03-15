interface PendingRefresh {
  key: string;
  refresh(): Promise<void>;
  promise: Promise<void>;
  resolve(): void;
  reject(error: unknown): void;
}

interface RefreshChannelState {
  activeKey?: string;
  forceNextRefresh: boolean;
  inFlight: Promise<void> | null;
  lastCompletedKey?: string;
  pending: PendingRefresh | null;
}

export interface AvailabilityCoordinator {
  requestSelectionRefresh(
    key: string,
    refresh: () => Promise<void>,
  ): Promise<void>;
  requestReaderRefresh(
    key: string,
    refresh: () => Promise<void>,
  ): Promise<void>;
  notifySelectionCopyCompleted(): void;
  notifyReaderCopyCompleted(): void;
}

export function createAvailabilityCoordinator(): AvailabilityCoordinator {
  const selection = createRefreshChannel();
  const reader = createRefreshChannel();

  return {
    requestSelectionRefresh(key, refresh): Promise<void> {
      return selection.requestRefresh(key, refresh);
    },
    requestReaderRefresh(key, refresh): Promise<void> {
      return reader.requestRefresh(key, refresh);
    },
    notifySelectionCopyCompleted(): void {
      selection.forceNextRefresh();
    },
    notifyReaderCopyCompleted(): void {
      reader.forceNextRefresh();
    },
  };
}

function createRefreshChannel(): {
  requestRefresh(key: string, refresh: () => Promise<void>): Promise<void>;
  forceNextRefresh(): void;
} {
  const state: RefreshChannelState = {
    forceNextRefresh: false,
    inFlight: null,
    pending: null,
  };

  const requestRefresh = (
    key: string,
    refresh: () => Promise<void>,
  ): Promise<void> => {
    if (state.inFlight) {
      if (
        !state.forceNextRefresh &&
        state.activeKey === key &&
        !state.pending
      ) {
        return state.inFlight;
      }

      if (!state.pending) {
        state.pending = buildPendingRefresh(key, refresh);
      } else {
        state.pending.key = key;
        state.pending.refresh = refresh;
      }

      return state.pending.promise;
    }

    if (!state.forceNextRefresh && state.lastCompletedKey === key) {
      return Promise.resolve();
    }

    const nextRefresh = runRefresh(state, key, refresh);
    state.inFlight = nextRefresh;
    return nextRefresh;
  };

  return {
    requestRefresh,
    forceNextRefresh(): void {
      state.forceNextRefresh = true;
    },
  };
}

async function runRefresh(
  state: RefreshChannelState,
  key: string,
  refresh: () => Promise<void>,
  completion?: Pick<PendingRefresh, "resolve" | "reject">,
): Promise<void> {
  state.activeKey = key;
  state.forceNextRefresh = false;
  let pending: PendingRefresh | null | undefined;

  try {
    await refresh();
    state.lastCompletedKey = key;
    completion?.resolve();
  } catch (error) {
    completion?.reject(error);
    throw error;
  } finally {
    state.activeKey = undefined;
    state.inFlight = null;
    pending = state.pending;
    state.pending = null;
  }

  if (!pending) {
    return;
  }

  if (!state.forceNextRefresh && state.lastCompletedKey === pending.key) {
    pending.resolve();
    return;
  }

  const nextRefresh = runRefresh(state, pending.key, pending.refresh, pending);
  state.inFlight = nextRefresh;
}

function buildPendingRefresh(
  key: string,
  refresh: () => Promise<void>,
): PendingRefresh {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    key,
    refresh,
    promise,
    resolve,
    reject,
  };
}
