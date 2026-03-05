# ZotClip Design (Zotero 8, Windows-first)

## 1. Context and Goal

ZotClip is a Zotero plugin focused on one core job: copy PDF attachment files so users can paste them as attachments into external apps when supported.

This capability is platform- and target-app-dependent, so the design uses a multi-layer fallback strategy rather than a single clipboard implementation.

## 2. Scope (v1)

### In scope

1. Copy PDFs from selected items/attachments in library view.
2. Copy currently opened PDF file from reader via keyboard.
3. Configurable multi-PDF strategy:
   - `all`: copy all PDF attachments.
   - `primary`: copy only the best/primary PDF attachment.
4. Clipboard fallback when file-object write fails.
5. User feedback with copy count and actual clipboard format used.

### Out of scope

1. Linux-specific optimization.
2. External native helper processes.
3. Backward compatibility with Zotero 7.

## 3. Product Decisions

1. Plugin name: `ZotClip`.
2. Target platform priority: `Windows`.
3. Target Zotero version: `Zotero 8`.
4. Reader copy behavior: `smart` mode.
   - Keep native text copy when text is selected.
   - Copy file only when no text is selected.
5. Fallback policy: allow absolute path text fallback.

## 4. Architecture

### 4.1 Module boundaries

1. `CommandLayer`
   - Entry points for menu and shortcuts.
   - Orchestrates resolve -> clipboard write -> notify.
2. `AttachmentResolver`
   - Resolves selected items or reader item to concrete PDF file paths.
3. `ClipboardWriter`
   - Writes clipboard data with layered strategy.
4. `ReaderHook`
   - Implements `Ctrl+C` interception logic in smart mode.
5. `Prefs`
   - Stores and exposes runtime configuration.
6. `Notifier`
   - Displays lightweight status messages.

### 4.2 Separation rules

1. Resolver does not touch clipboard.
2. Writer does not query Zotero items.
3. Reader hook decides keyboard behavior only.
4. All user-visible operations are initiated by command layer.

## 5. Data Flow

### 5.1 Flow A: library selection -> copy

1. Trigger copy command from library context.
2. Read selected `Zotero.Item[]`.
3. Resolve PDFs by mode:
   - If selected item is attachment: accept only `isPDFAttachment()`.
   - If selected item is regular item:
     - `all`: inspect child attachments and filter PDF attachments.
     - `primary`: use `getBestAttachment()`/`getBestAttachments()` then validate PDF.
4. Resolve file paths via `getFilePathAsync()` and filter invalid paths.
5. Write clipboard via `ClipboardWriter`.
6. Notify final result.

### 5.2 Flow B: reader current PDF -> copy

1. Hook reader keydown handling.
2. On `Ctrl+C` with `smart` mode:
   - If text selection exists, do nothing (native copy).
   - If no selection, intercept and trigger file copy.
3. Resolve current reader attachment via reader instance `itemID`.
4. Reuse same writer pipeline.
5. Notify final result.

## 6. API Sketch

```ts
type MultiPDFMode = "all" | "primary";

type ResolvedPDF = {
  itemID: number;
  attachmentID: number;
  path: string;
};

type ClipboardFormat = "file-object" | "uri-list" | "path-text" | "none";

type ClipboardResult = {
  ok: boolean;
  format: ClipboardFormat;
  count: number;
  message?: string;
};

async function resolvePDFsFromItems(
  items: Zotero.Item[],
  mode: MultiPDFMode,
): Promise<ResolvedPDF[]>;

async function resolvePDFFromReader(itemID: number): Promise<ResolvedPDF[]>;

async function writeClipboard(
  files: ResolvedPDF[],
  allowPathFallback: boolean,
): Promise<ClipboardResult>;

async function handleReaderCopyShortcut(event: KeyboardEvent): Promise<void>;
```

## 7. Clipboard Strategy

Three-stage write strategy:

1. Try file-object clipboard write (best UX when target app supports file paste).
2. If failed, try `text/uri-list` where feasible.
3. If still failed and fallback allowed, copy absolute path text (newline-delimited for multiple files).

Behavioral requirement: always report the effective format used.

## 8. Error Handling

Standardized result categories:

1. `RESOLVE_EMPTY`: no valid PDFs resolved.
2. `RESOLVE_PARTIAL`: partial success when multiple inputs are selected.
3. `CLIPBOARD_FILE_FAILED`: file-object stage failed.
4. `CLIPBOARD_FALLBACK_USED`: fallback succeeded.
5. `CLIPBOARD_ALL_FAILED`: all stages failed.

## 9. Preferences (v1)

Only three settings are included:

1. `multiPdfMode`: `all | primary`
2. `readerCtrlCMode`: `smart | never | always`
3. `allowPathFallback`: `boolean`

## 10. UX Messages

Example messages:

1. `Copied 3 PDF file(s) to clipboard (file-object).`
2. `File clipboard unavailable. Copied 3 file path(s) instead.`
3. `No available PDF files found for current selection.`
4. `Copy failed. Please check file availability and clipboard support in target app.`

## 11. Tech Stack

1. `TypeScript`
2. `windingwind/zotero-plugin-template`
3. `windingwind/zotero-plugin-toolkit`
4. `windingwind/zotero-types`

Rationale: strong community adoption, fast dev workflow, and complete type coverage for Zotero APIs.

## 12. Prior-art and Positioning

1. Existing attachment plugins such as ZotFile and zotero-file focus on attachment management (rename/move/sync), not clipboard file-copy workflows.
2. Zotero core issue for file clipboard support exists and remains unresolved in core, confirming plugin-level opportunity.

## 13. Test Strategy

### 13.1 Unit tests

1. Resolver: attachment vs regular items, `all` vs `primary`, invalid path filtering.
2. Writer: file-object success, fallback success, all-fail behavior.
3. Reader hook: smart-mode pass-through vs interception.

### 13.2 Integration tests

1. Library multi-selection copy count and format notification.
2. Reader `Ctrl+C` smart behavior.
3. Preference toggles and runtime behavior.

### 13.3 Manual compatibility checks (Windows)

1. Paste into File Explorer.
2. Paste into chat applications.
3. Paste into web AI upload text areas.

## 14. Acceptance Criteria (v1)

1. Copy works for selected PDF attachments and multi-selection.
2. Reader `Ctrl+C` smart mode behaves correctly.
3. Multi-PDF strategy is configurable and validated.
4. Path fallback works when file-object write fails.
5. Runs stably on Zotero 8.

## 15. References

1. https://github.com/zotero/zotero/issues/2274
2. https://forums.zotero.org/discussion/91986/feature-request-directly-copy-pdf-from-right-click-menu
3. https://www.zotero.org/support/dev/zotero_8_for_developers
4. https://github.com/windingwind/zotero-plugin-template
5. https://github.com/windingwind/zotero-plugin-toolkit
6. https://github.com/windingwind/zotero-types
7. https://github.com/jlegewie/zotfile
8. https://github.com/daidaishengweinan/zotero-file
