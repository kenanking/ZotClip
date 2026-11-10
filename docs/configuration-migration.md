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

The `.zotclip` version 2 container is a sequence of length-prefixed records.
Only this format is supported. Its 37-byte public header contains `ZOTCLIP`,
a version byte, an encryption flag (0 or 1), a 16-byte salt, an 8-byte nonce prefix
and the PBKDF2 iteration count. The manifest schema remains version 1.

For encrypted files, the salt and nonce prefix are randomly generated.
PBKDF2-SHA-256 (600,000 iterations) derives an AES-256-GCM key. Every record has
a unique nonce formed from the prefix and a 32-bit record index. The header and
index are authenticated additional data, with a 128-bit authentication tag.
For unencrypted files, the salt, nonce and iteration fields are zero. Records
contain plaintext followed by SHA-256 of the header, record index and plaintext.
These checksums detect accidental corruption; they do not authenticate a sender
or protect against someone rewriting a file and recomputing the checksums.

The first record contains the manifest, preferences and credentials; subsequent
records contain files in manifest order. Nothing is compressed again. Encryption
is off by default, independently of AI key selection. The UI identifies readable
AI keys in unencrypted exports, while preview values remain masked in both modes.

Encryption covers names and credentials as well as resource files. File sizes
and the number of records remain observable. Export processes one file at
a time instead of constructing an in-memory archive. Limits are 64 MiB per file,
512 MiB per package, 20,000 entries and a 4 MiB manifest. This bounds memory and
rejects oversized input before allocating a record buffer. The preview
initially renders 100 rows and loads more on demand. Collection runs only when
requested, with cancellation between records.

Export writes to a temporary file and renames it on success. Existing
packages are never overwritten. Import checks every record before
offering changes. Resource files are staged in a private temporary directory;
credentials remain in memory until written through the login manager. Closing
Preferences or a validation failure removes staging files. Passwords and keys
are not logged. A process crash may leave staged resource files in the operating
system's temporary directory; that directory contains no credential manifest.

## Applying and recovery

Before writes, ZotClip checks the preview against current settings and resources,
validates destination paths, pauses/cancels AI tag tasks and creates a recovery
copy using the imported file's encryption mode and, when encrypted, password.
An unencrypted recovery copy may contain previous AI keys. The preview states
which mode will be used. If that copy cannot be saved, configuration is not
changed. It checks for changes again after the copy and writes regular resource
files atomically. Plug-ins are installed last via AddonManager, including a check
that the XPI ID/version matches its manifest. A normal import skips
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

Unit coverage exercises encrypted and unencrypted round trips with AI keys,
corruption, unsupported format versions, wrong passwords,
record swapping, size limits, path traversal and recovery-only deletion entries.
`test/migration.test.ts` exercises real preferences, login-manager storage,
resource recovery, XPI installation, the inline preferences section, localized
light/dark UI, confirmation and key masking in an isolated Zotero profile.
Integration tests pass on Zotero 8.0.4, 9.0.6, and 10.0.1 in Linux CI, and on
Zotero 10.0.1 and 11.0-beta.4 on Windows. See [validation.md](validation.md).
