import { renderCopyDiagnosticsLine } from "../copyMessages";
import { getClipboardDiagnostics } from "../runtimeDiagnostics";
import { createNoopHandle } from "../ui/disposables";

export interface DiagnosticsSectionDeps {
  getClipboardDiagnostics?(): ReturnType<typeof getClipboardDiagnostics>;
  renderLine?(
    line: Awaited<ReturnType<typeof getClipboardDiagnostics>>["lines"][number],
  ): string;
}

export async function registerDiagnosticsSection(
  doc: Document,
  deps: DiagnosticsSectionDeps = {},
): Promise<{ dispose(): void }> {
  const diagnosticsList = doc.querySelector<HTMLElement>(
    "[data-zotclip-diagnostics-list]",
  );
  if (!diagnosticsList) {
    return createNoopHandle();
  }

  try {
    const diagnostics =
      (await deps.getClipboardDiagnostics?.()) ||
      (await getClipboardDiagnostics());
    replaceChildren(
      diagnosticsList,
      diagnostics.lines.map((line) =>
        createDiagnosticsRow(
          doc,
          deps.renderLine?.(line) || renderCopyDiagnosticsLine(line),
        ),
      ),
    );
  } catch (error) {
    replaceChildren(diagnosticsList, [
      createDiagnosticsRow(
        doc,
        `Diagnostics unavailable: ${getErrorMessage(error)}`,
      ),
    ]);
  }

  return createNoopHandle();
}

function createDiagnosticsRow(doc: Document, value: string): HTMLElement {
  const row = doc.createElement("div");
  row.className = "zotclip-pref-diagnostics-row";
  row.textContent = value;
  return row;
}

function replaceChildren(
  container: HTMLElement,
  children: HTMLElement[],
): void {
  if ("replaceChildren" in container) {
    container.replaceChildren(...children);
    return;
  }

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  for (const child of children) {
    container.appendChild(child);
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
