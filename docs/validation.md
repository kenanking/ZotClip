# Zotero 8–11 validation

Validated on 2026-11-10 on Linux x64 and Windows, Node 26.13.0, TypeScript 6.0.3.
The [passing CI run](https://github.com/kenanking/ZotClip/actions/runs/42808842771)
covers the fixes prepared for v0.6.3. Release packages take their version from
`package.json`.

## Automated checks

| Check                                 | Result                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Unit tests                            | 205 passed                                                                               |
| Production build and TypeScript check | Passed                                                                                   |
| Prettier and ESLint                   | Passed                                                                                   |
| Zotero 8.0.4, Linux                   | 32 integration tests passed                                                              |
| Zotero 9.0.6, Linux                   | 32 integration tests passed                                                              |
| Zotero 10.0.1, Linux                  | 32 integration tests passed                                                              |
| Zotero 10.0.1, Windows                | 33 integration tests passed                                                              |
| Zotero 11.0-beta.4+045d52044, Windows | 33 integration tests passed                                                              |
| GTK4 clipboard on isolated X11        | Both file MIME types readable after 61 seconds; helper exits after ownership replacement |

Each integration run downloads and verifies the pinned application version,
creates a fresh profile and database, and disables application updates. Fixtures
contain only synthetic credentials, metadata, and files. Zotero 8.0.4 is the
Linux build used for the 8.x matrix; 8.0.5 was a macOS-only maintenance release.

Integration coverage includes completed plugin startup; main, tab-reader and
standalone-reader toolbars; originating reader-window identification; real
login-manager save/replace/delete and origin isolation; private temporary file
permissions, duplicate copies and old-session cleanup; real item saves; Zotero
10 undo/redo for manual tags; exclusion of background tags from undo; cancelled
responses and deleted-item guards; encrypted and unencrypted configuration
migration; and startup with destroyed reader-window references. AI responses
are stubbed: no external paid API is contacted.

The final integration test removes the temporary development add-on, installs
the production XPI through AddonManager, checks its ID, version and compatibility,
and waits for production initialization. Temporary add-on installation alone
bypasses compatibility checks and is not accepted as packaging validation.

Run the commands in [README.md](../README.md). Per-version logs are retained in
`.scaffold/validation/`; CI uploads logs on success or failure. The runner fails
if no completed passing test report is received and stops its isolated process
group after a timeout.

## Compatibility decisions

The source manifest requires Zotero 8.0 and permits 11.0.*. Zotero 11 validation
currently covers the beta build listed above. The build target is
Firefox 140. No plugin code uses the removed singular collection getters,
collection-row menu context, legacy full-text tables, or CookieSandbox APIs.
Item selection continues through ZoteroPane APIs; write permission is rechecked
on the item itself. Manual undo uses the documented save options only on 10+.

Reference: [Zotero 10 developer migration guide](https://www.zotero.org/support/dev/zotero_10_for_developers).

## Remaining platform validation

These automated results do not replace the [manual checklist](manual-testing.md).
Windows cache ACLs are covered by the Windows integration runs. Windows
file-manager/browser paste interoperability, macOS Finder/AppKit, native
Wayland, IME interaction, live provider authentication, and real group-permission
changes still need manual verification.
The X11 test reads clipboard MIME data through GTK; it does not automate a file
manager's paste command.
