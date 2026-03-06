const CF_HDROP = 15;
const DROPFILES_HEADER_SIZE = 20;
const DROPFILES_WIDE_FLAG_OFFSET = 16;
const GMEM_MOVEABLE = 0x0002;
const GMEM_ZEROINIT = 0x0040;

export interface WindowsFileClipboardDeps {
  openClipboard(): boolean;
  emptyClipboard(): boolean;
  allocate(size: number): unknown | null;
  writeBytes(handle: unknown, bytes: Uint8Array): boolean;
  setClipboardDropFiles(handle: unknown): boolean;
  free(handle: unknown): void;
  closeClipboard(): void;
}

const DEFAULT_DEPS: WindowsFileClipboardDeps = {
  openClipboard: () => {
    const api = getWin32ClipboardApi();
    return !!api.OpenClipboard(api.ctypes.voidptr_t(0));
  },
  emptyClipboard: () => {
    const api = getWin32ClipboardApi();
    return !!api.EmptyClipboard();
  },
  allocate: (size) => {
    const api = getWin32ClipboardApi();
    const handle = api.GlobalAlloc(
      GMEM_MOVEABLE | GMEM_ZEROINIT,
      api.ctypes.size_t(size),
    );
    return isNullPointer(handle) ? null : handle;
  },
  writeBytes: (handle, bytes) => {
    const api = getWin32ClipboardApi();
    const locked = api.GlobalLock(handle);
    if (isNullPointer(locked)) {
      return false;
    }

    try {
      const targetType = api.ctypes.uint8_t.array(bytes.length);
      const target = api.ctypes.cast(locked, targetType.ptr).contents;
      for (let index = 0; index < bytes.length; index += 1) {
        target[index] = bytes[index];
      }
      return true;
    } finally {
      api.GlobalUnlock(handle);
    }
  },
  setClipboardDropFiles: (handle) => {
    const api = getWin32ClipboardApi();
    const result = api.SetClipboardData(CF_HDROP, handle);
    return !isNullPointer(result);
  },
  free: (handle) => {
    const api = getWin32ClipboardApi();
    if (handle) {
      api.GlobalFree(handle);
    }
  },
  closeClipboard: () => {
    const api = getWin32ClipboardApi();
    api.CloseClipboard();
  },
};

export function buildDropFilesPayload(paths: string[]): Uint8Array {
  const encodedList = encodeUtf16Le(`${paths.join("\0")}\0\0`);
  const payload = new Uint8Array(DROPFILES_HEADER_SIZE + encodedList.length);
  const view = new DataView(payload.buffer);

  view.setUint32(0, DROPFILES_HEADER_SIZE, true);
  view.setUint32(DROPFILES_WIDE_FLAG_OFFSET, 1, true);
  payload.set(encodedList, DROPFILES_HEADER_SIZE);

  return payload;
}

export function writeWindowsFileDrop(
  paths: string[],
  deps: WindowsFileClipboardDeps = DEFAULT_DEPS,
): boolean {
  const normalizedPaths = paths
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
  if (!normalizedPaths.length) {
    return false;
  }

  const payload = buildDropFilesPayload(normalizedPaths);
  const opened = deps.openClipboard();
  if (!opened) {
    return false;
  }

  let handle: unknown | null = null;
  let ownershipTransferred = false;

  try {
    if (!deps.emptyClipboard()) {
      return false;
    }

    handle = deps.allocate(payload.length);
    if (!handle) {
      return false;
    }

    if (!deps.writeBytes(handle, payload)) {
      return false;
    }

    if (!deps.setClipboardDropFiles(handle)) {
      return false;
    }

    ownershipTransferred = true;
    return true;
  } finally {
    if (!ownershipTransferred && handle) {
      deps.free(handle);
    }
    deps.closeClipboard();
  }
}

function encodeUtf16Le(value: string): Uint8Array {
  const encoded = new Uint8Array(value.length * 2);

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    encoded[index * 2] = codeUnit & 0xff;
    encoded[index * 2 + 1] = codeUnit >> 8;
  }

  return encoded;
}

interface Win32ClipboardApi {
  ctypes: any;
  CloseClipboard: any;
  EmptyClipboard: any;
  GlobalAlloc: any;
  GlobalFree: any;
  GlobalLock: any;
  GlobalUnlock: any;
  OpenClipboard: any;
  SetClipboardData: any;
}

let cachedApi: Win32ClipboardApi | undefined;

function getWin32ClipboardApi(): Win32ClipboardApi {
  if (cachedApi) {
    return cachedApi;
  }

  const { ctypes } = ChromeUtils.importESModule(
    "resource://gre/modules/ctypes.sys.mjs",
  ) as any;
  const user32 = ctypes.open("user32.dll");
  const kernel32 = ctypes.open("kernel32.dll");

  cachedApi = {
    ctypes,
    CloseClipboard: user32.declare(
      "CloseClipboard",
      ctypes.winapi_abi,
      ctypes.bool,
    ),
    EmptyClipboard: user32.declare(
      "EmptyClipboard",
      ctypes.winapi_abi,
      ctypes.bool,
    ),
    GlobalAlloc: kernel32.declare(
      "GlobalAlloc",
      ctypes.winapi_abi,
      ctypes.voidptr_t,
      ctypes.uint32_t,
      ctypes.size_t,
    ),
    GlobalFree: kernel32.declare(
      "GlobalFree",
      ctypes.winapi_abi,
      ctypes.voidptr_t,
      ctypes.voidptr_t,
    ),
    GlobalLock: kernel32.declare(
      "GlobalLock",
      ctypes.winapi_abi,
      ctypes.voidptr_t,
      ctypes.voidptr_t,
    ),
    GlobalUnlock: kernel32.declare(
      "GlobalUnlock",
      ctypes.winapi_abi,
      ctypes.bool,
      ctypes.voidptr_t,
    ),
    OpenClipboard: user32.declare(
      "OpenClipboard",
      ctypes.winapi_abi,
      ctypes.bool,
      ctypes.voidptr_t,
    ),
    SetClipboardData: user32.declare(
      "SetClipboardData",
      ctypes.winapi_abi,
      ctypes.voidptr_t,
      ctypes.uint32_t,
      ctypes.voidptr_t,
    ),
  };

  return cachedApi;
}

function isNullPointer(value: any): boolean {
  if (!value) {
    return true;
  }

  if (typeof value.isNull === "function") {
    return value.isNull();
  }

  return false;
}
