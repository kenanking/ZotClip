declare const _globalThis: {
  [key: string]: any;
  Zotero: _ZoteroTypes.Zotero;
  ztoolkit: ZToolkit;
  addon: typeof addon;
};

declare type ZToolkit = ReturnType<
  typeof import("../src/utils/ztoolkit").createZToolkit
>;

declare const ztoolkit: ZToolkit;

declare const rootURI: string;

declare const addon: import("../src/addon").default;

declare const __env__: "production" | "development";

// Firefox 153 adds async mutations; Zotero 8–10 use the synchronous methods.
interface nsILoginManager {
  modifyLoginAsync?(
    oldLogin: nsILoginInfo,
    newLogin: nsILoginInfo,
  ): Promise<void>;
  removeLoginAsync?(login: nsILoginInfo): Promise<void>;
}
