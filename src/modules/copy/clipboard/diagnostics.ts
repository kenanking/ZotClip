import type { PlatformContext } from "./platformDetection";
import { isChineseLanguageTag, localizeKnownCopyMessage } from "../uiStrings";

export interface ClipboardDiagnosticsInput {
  activeBackend?: string;
  commands?: Record<string, boolean>;
  languageTag?: string;
  lastFallbackReason?: string;
  linuxSession?: PlatformContext["linuxSession"];
  platform: PlatformContext["platform"];
}

export interface ClipboardDiagnostics {
  activeBackend: string;
  commands: Record<string, boolean>;
  languageTag?: string;
  lastFallbackReason?: string;
  lines: string[];
  linuxSession?: PlatformContext["linuxSession"];
  platform: PlatformContext["platform"];
}

export function buildClipboardDiagnostics(
  input: ClipboardDiagnosticsInput,
): ClipboardDiagnostics {
  const commands = input.commands || {};
  const activeBackend = input.activeBackend || "unknown";
  const isChinese = isChineseLanguageTag(input.languageTag);
  const lines = [
    buildPlatformLine(input, isChinese),
    ...Object.entries(commands).map(
      ([command, available]) =>
        `${command}${isChinese ? "：" : ": "}${available ? (isChinese ? "可用" : "available") : isChinese ? "缺失" : "missing"}`,
    ),
    `${isChinese ? "当前后端" : "Active backend"}${isChinese ? "：" : ": "}${activeBackend}`,
  ];

  if (input.lastFallbackReason) {
    lines.push(
      `${isChinese ? "说明" : "Note"}${isChinese ? "：" : ": "}${localizeKnownCopyMessage(input.lastFallbackReason, input.languageTag) || input.lastFallbackReason}`,
    );
  }

  const installCommand = buildInstallCommand(input);
  if (installCommand) {
    lines.push(
      `${isChinese ? "安装命令" : "Install command"}${isChinese ? "：" : ": "}${installCommand}`,
    );
    lines.push(
      isChinese
        ? "如果仍有问题，请自行排查系统剪贴板环境。"
        : "If issues persist, troubleshoot your system clipboard environment manually.",
    );
  }

  return {
    platform: input.platform,
    linuxSession: input.linuxSession,
    commands,
    activeBackend,
    languageTag: input.languageTag,
    lastFallbackReason: input.lastFallbackReason,
    lines,
  };
}

function buildPlatformLine(
  input: ClipboardDiagnosticsInput,
  isChinese: boolean,
): string {
  if (input.platform === "linux") {
    return `${isChinese ? "平台" : "Platform"}${isChinese ? "：" : ": "}linux (${input.linuxSession || "unknown"})`;
  }

  return `${isChinese ? "平台" : "Platform"}${isChinese ? "：" : ": "}${input.platform}`;
}

function buildInstallCommand(
  input: ClipboardDiagnosticsInput,
): string | undefined {
  if (input.platform !== "linux") {
    return undefined;
  }

  const commands = input.commands || {};

  if (commands["gtk4-helper"] === false) {
    return "sudo apt install python3-gi gir1.2-gtk-4.0";
  }

  if (commands.xclip === false) {
    return "sudo apt install xclip";
  }

  if (commands["wl-copy"] === false) {
    return "sudo apt install wl-clipboard";
  }

  return undefined;
}
