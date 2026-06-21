import type { TFunction } from "i18next";

const screenshotSuccessPattern =
  /\b(?:screenshot\s+(?:saved|captured)|saved\s+screenshot|captured\s+screenshot)\b/i;
const omittedImageOutputPattern =
  /^\[(?:1 image output|\d+ image outputs) omitted from text context\]$/i;
const emptyOutputPattern = /^\(no output\)$/i;
const weakSuccessPattern = /^command completed successfully$/i;

export type CollapsedToolSummary =
  | { kind: "none" }
  | { kind: "lines"; count: number }
  | { kind: "screenshot" }
  | { kind: "error"; text: string };

function isScreenshotToolName(toolName?: string): boolean {
  if (!toolName) {
    return false;
  }
  const lower = toolName.toLowerCase();
  if (lower.endsWith("__screenshot_for_display")) {
    return true;
  }
  return /(?:^|__|_)(?:screenshot|take_screenshot|capture_screenshot)(?:$|__|_)/.test(
    lower,
  );
}

export function shouldUseScreenshotSummary(
  toolName: string | undefined,
  content: string,
): boolean {
  if (isScreenshotToolName(toolName)) {
    return true;
  }
  return screenshotSuccessPattern.test(content);
}

export function getCollapsedToolSummary(
  toolName: string | undefined,
  content: unknown,
  isError = false,
  hasToolResult = true,
): CollapsedToolSummary {
  const normalized = typeof content === "string" ? content.trim() : "";

  if (!hasToolResult) {
    return { kind: "none" };
  }

  if (!isError && shouldUseScreenshotSummary(toolName, normalized)) {
    return { kind: "screenshot" };
  }

  if (!normalized) {
    return { kind: "none" };
  }

  if (isError) {
    const firstLine = normalized.split(/\r?\n/)[0] ?? "";
    return {
      kind: "error",
      text:
        firstLine.length > 60 ? `${firstLine.substring(0, 57)}...` : firstLine,
    };
  }

  if (
    weakSuccessPattern.test(normalized) ||
    omittedImageOutputPattern.test(normalized) ||
    emptyOutputPattern.test(normalized)
  ) {
    return { kind: "none" };
  }

  return {
    kind: "lines",
    count: normalized.split(/\r?\n/).length,
  };
}

export function formatCollapsedToolSummary(
  summary: CollapsedToolSummary,
  t: TFunction,
): string {
  if (summary.kind === "lines") {
    return t("tool.summaryLines", { count: summary.count });
  }
  if (summary.kind === "screenshot") {
    return t("tool.summaryScreenshot");
  }
  if (summary.kind === "error") {
    return summary.text;
  }
  return "";
}

export function shouldPreferToolResultImages(
  toolName: string | undefined,
  content: string,
  hasImages: boolean,
  isError = false,
): boolean {
  if (isError || !hasImages) {
    return false;
  }

  const normalized = content.trim();
  if (shouldUseScreenshotSummary(toolName, normalized)) {
    return true;
  }

  return (
    omittedImageOutputPattern.test(normalized) ||
    emptyOutputPattern.test(normalized)
  );
}

export function shouldRenderToolResultText(
  toolName: string | undefined,
  content: string,
  hasImages: boolean,
  isError = false,
): boolean {
  if (!content.trim()) {
    return false;
  }

  return !shouldPreferToolResultImages(toolName, content, hasImages, isError);
}
