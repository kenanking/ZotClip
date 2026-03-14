import { renderCopyDiagnosticsLine } from "../copyMessages";
import { getClipboardDiagnostics } from "../runtimeDiagnostics";

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
  const diagnosticsValue = doc.querySelector<HTMLElement>(
    "[data-zotclip-diagnostics-value]",
  );
  if (!diagnosticsValue) {
    return createNoopHandle();
  }

  try {
    const diagnostics =
      (await deps.getClipboardDiagnostics?.()) ||
      (await getClipboardDiagnostics());
    diagnosticsValue.textContent = diagnostics.lines
      .map((line) => deps.renderLine?.(line) || renderCopyDiagnosticsLine(line))
      .join("\n");
  } catch (error) {
    diagnosticsValue.textContent = `Diagnostics unavailable: ${getErrorMessage(error)}`;
  }

  return createNoopHandle();
}

function createNoopHandle(): { dispose(): void } {
  return {
    dispose(): void {},
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
