import { describe, expect, it } from "vitest";
import {
  formatCollapsedToolSummary,
  getCollapsedToolSummary,
} from "../../renderer/utils/tool-result-summary";

describe("getCollapsedToolSummary", () => {
  it("counts lines for non-empty successful text output", () => {
    expect(getCollapsedToolSummary("read", "hello", false)).toEqual({
      kind: "lines",
      count: 1,
    });
  });

  it("counts multi-line successful output", () => {
    expect(getCollapsedToolSummary("bash", "a\nb\nc", false)).toEqual({
      kind: "lines",
      count: 3,
    });
  });

  it("returns screenshot summary for screenshot tools", () => {
    expect(
      getCollapsedToolSummary("internal_browser_screenshot", "saved", false),
    ).toEqual({ kind: "screenshot" });
  });

  it("returns screenshot summary for screenshot success text", () => {
    expect(getCollapsedToolSummary("bash", "Screenshot saved", false)).toEqual({
      kind: "screenshot",
    });
  });

  it("suppresses weak success boilerplate", () => {
    expect(
      getCollapsedToolSummary("bash", "Command completed successfully", false),
    ).toEqual({ kind: "none" });
  });

  it("suppresses omitted image placeholder text", () => {
    expect(
      getCollapsedToolSummary(
        "mcp__GUI_Operate__screenshot_for_display",
        "[1 image output omitted from text context]",
        false,
      ),
    ).toEqual({ kind: "screenshot" });
  });

  it("returns none for empty or non-string content", () => {
    expect(getCollapsedToolSummary("read", "", false)).toEqual({
      kind: "none",
    });
    expect(getCollapsedToolSummary("read", null, false)).toEqual({
      kind: "none",
    });
    expect(getCollapsedToolSummary("read", 42, false)).toEqual({
      kind: "none",
    });
  });

  it("returns none when the tool result is missing", () => {
    expect(
      getCollapsedToolSummary(
        "internal_browser_screenshot",
        undefined,
        false,
        false,
      ),
    ).toEqual({ kind: "none" });
  });

  it("truncates the first error line", () => {
    expect(getCollapsedToolSummary("bash", "E".repeat(100), true)).toEqual({
      kind: "error",
      text: `${"E".repeat(57)}...`,
    });
  });

  it("uses only the first error line", () => {
    expect(
      getCollapsedToolSummary("bash", "permission denied\nstack trace", true),
    ).toEqual({
      kind: "error",
      text: "permission denied",
    });
  });
});

describe("formatCollapsedToolSummary", () => {
  const t = (key: string, options?: { count?: number }) => {
    if (key === "tool.summaryLines") {
      return `${options?.count} lines`;
    }
    if (key === "tool.summaryScreenshot") {
      return "Screenshot";
    }
    return key;
  };

  it("formats line summaries through i18n", () => {
    expect(
      formatCollapsedToolSummary({ kind: "lines", count: 3 }, t as never),
    ).toBe("3 lines");
  });

  it("formats screenshot summaries through i18n", () => {
    expect(formatCollapsedToolSummary({ kind: "screenshot" }, t as never)).toBe(
      "Screenshot",
    );
  });

  it("passes through error text and suppresses none", () => {
    expect(
      formatCollapsedToolSummary({ kind: "error", text: "boom" }, t as never),
    ).toBe("boom");
    expect(formatCollapsedToolSummary({ kind: "none" }, t as never)).toBe("");
  });
});
