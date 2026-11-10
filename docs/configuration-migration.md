# Configuration migration

ZotClip implements this feature independently. It uses Zotero's preferences,
login manager, AddonManager and file APIs; it does not execute or import Tara code
or read Tara backup formats.

## Scope

| Content                             | Behavior                                                                                                                                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preferences                         | User-set `extensions.*` values and ZotClip defaults. Retains booleans, integers and strings including `false`, `0` and empty strings. Filters credential-like names, sync/runtime/debug state and data-directory settings. |
| ZotClip AI keys                     | All saved provider/origin identities, including inactive providers. Restored through the existing credential store. Values are never displayed in the preview.                                                             |
| Plug-ins                            | Installed regular XPI extensions, version and enabled/disabled state. Excludes ZotClip, bundled integrations, system/built-in and temporary installations. Unpacked installations are omitted.                             |
| Styles, translators, locate engines | Regular files under the corresponding Zotero data-directory folders, including nested and Unicode paths. Symbolic links are omitted.                                                                                       |
| Local paths                         | Not selected automatically. A selected path must be mapped to an existing absolute destination path. Recovery copies restore the prior value.                                                                              |

Unselected and unrelated destination entries remain in place. The feature does
not copy library databases, attachments, Zotero sign-in credentials, private
plug-in databases or every Firefox preference. It has no cloud service, scheduled
backup, retention history or automatic cross-device synchronization.

## Package and resource use

The `.zotclip` version 1 container is a sequence of length-prefixed authenticated
records. Its 36-byte public header contains `ZOTCLIP`, a version byte, a random
16-byte salt, an 8-byte random nonce prefix and the PBKDF2 iteration count.
PBKDF2-SHA-256 (600,000 iterations) derives an AES-256-GCM key. Every record has
a unique nonce formed from the prefix and a 32-bit record index. The header and
index are authenticated additional data, with a 128-bit authentication tag.
The first encrypted record contains the manifest, preferences and credentials;
subsequent records contain files in manifest order. Nothing is compressed again.

The entire package, including names and credentials, is encrypted. File sizes
and the number of records are observable. Export reads and encrypts one file at
a time instead of constructing an in-memory archive. Limits are 64 MiB per file,
512 MiB per package, 20,000 entries and a 4 MiB manifest. This bounds memory and
rejects oversized input before decryption allocates a file buffer. The preview
initially renders 100 rows and loads more on demand. Collection runs only when
requested, with cancellation between records.

Export writes to a temporary encrypted file and renames it on success. Existing
packages are never overwritten. Import authenticates the complete package before
offering changes. Resource files are staged in a private temporary directory;
credentials remain in memory until written through the login manager. Closing
the dialog or a validation failure removes staging files. Passwords and keys
are not logged. A process crash may leave staged resource files in the operating
system's temporary directory; that directory contains no credential manifest.

## Applying and recovery

Before writes, ZotClip checks the preview against current settings and resources,
validates destination paths, pauses/cancels AI tag tasks and creates a password-
encrypted recovery copy. If that copy cannot be saved, configuration is not
changed. It checks for changes again after the copy and writes regular resource
files atomically. Plug-ins are installed last via AddonManager, including a check
that the XPI ID/version matches its encrypted manifest. A normal import skips
newer installed versions and unsupported installations. An explicitly opened
recovery copy can restore an older plug-in version.

This is not a transaction across Zotero and arbitrary plug-in startup code.
A settings/resource error stops subsequent writes; an individual plug-in failure
is reported while other selected plug-ins may continue. The result identifies
completed and failed entries and the recovery-copy location. Recovery restores
prior settings, keys, overwritten files and available XPIs, and removes resource
files introduced by the import. Newly installed plug-ins and changes performed
by their own code may require manual cleanup. Restart Zotero after applying or
recovering resources so its caches reload.

## Validation

Unit coverage exercises cryptographic round trips, corruption, wrong passwords,
record swapping, size limits, path traversal and recovery-only deletion entries.
`test/migration.test.ts` exercises real preferences, login-manager storage,
resource recovery, XPI installation, the packaged preferences entry, localized
light/dark UI, confirmation and key masking in an isolated Zotero profile.
The local integration run uses Zotero 11.0-beta.4; Zotero 8–10 retain the existing
API compatibility paths and need separate version-matrix testing before release.
