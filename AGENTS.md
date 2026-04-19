# Repository Guidelines

## Project Layout

- `src/`: TypeScript source. Copy logic lives in `src/modules/copy/`.
- `addon/`: packaged Zotero assets such as `manifest.json`, prefs, locale, and
  icons.
- `spec/unit/`: fast unit tests run by `npm run test:unit`.
- `test/`: scaffold/Zotero startup tests run by `npm run test`.
- `docs/manual-testing.md`: manual verification checklist.

## Commands

- `npm install`: install dependencies.
- `npm run start`: run the Zotero plugin dev loop.
- `npm run build`: build the add-on and run `tsc --noEmit`.
- `npm run lint:check`: run Prettier and ESLint in check mode.
- `npm run lint:fix`: apply Prettier and ESLint fixes.
- `npm run test:unit`: run unit tests in `spec/unit/`.
- `npm run test`: run scaffold/Zotero tests.

For local `npm run test` on this machine, set:

```powershell
$env:ZOTERO_PLUGIN_ZOTERO_BIN_PATH='C:\Program Files\Zotero\zotero.exe'
```

## Coding Style

- Use TypeScript ESM with 2-space indentation and LF line endings.
- Prefer `camelCase` for values/functions and `PascalCase` for types/classes.
- Keep modules focused:
  - resolver logic in `attachmentResolver.ts`
  - clipboard behavior in `clipboardWriter.ts`
  - UI strings in locale files

## Compatibility

- Do not preserve backward compatibility unless the user explicitly asks for it.
- Prefer removing legacy preferences, migrations, compatibility shims, and old
  behavior branches instead of carrying them forward.
- When changing behavior, optimize for the current plugin contract rather than
  upgrade-path compatibility.

## Testing

- Add or update targeted tests for every behavior change.
- Prefer `npm run test:unit` while iterating.
- Before commit, run `npm run test:unit`, `npm run build`, and
  `npm run lint:check`.
- Run `npm run test` as well when Zotero-based integration coverage is needed
  and the Zotero binary path is configured.

## Release

- Releases are triggered by pushing a Git tag that matches `v**`.
- Before a release, run `npm run test:unit`, `npm run build`, and
  `npm run lint:check`.
- Bump the version with `npm run release -- patch --yes`,
  `npm run release -- minor --yes`, or `npm run release -- major --yes`.
  This creates a version commit (`chore(publish): release vX.Y.Z`) and a
  matching Git tag, then pushes both automatically.
- Do **not** use `npm version` directly; it produces a generic commit message
  that does not match the project's conventional-release configuration.
- The GitHub Actions release workflow then runs `npm run build` and
  `npm run release`.
- If an agent updates compatibility claims, release notes, or packaging, it
  must verify that `package.json`, `addon/manifest.json`, and the release tag
  stay consistent.

## Commits

- Use conventional prefixes such as `feat:`, `fix:`, `docs:`, and `chore:`.
- Keep commits narrow and describe the user-visible change.
