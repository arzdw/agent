import { describe, it, expect } from "vitest";
import { getToolShortLabel } from "../../renderer/components/message/toolHelpers";
import type { TFunction } from "i18next";

/** Minimal TFunction mock: returns the i18n key itself so we verify mapping, not translation values. */
const t: TFunction = ((key: string) => key) as unknown as TFunction;

describe("getToolShortLabel", () => {
  // ── file tools ──

  it("maps bash to tool.actionBash", () => {
    expect(getToolShortLabel("bash", t)).toBe("tool.actionBash");
  });

  it("maps execute_command to tool.actionBash", () => {
    expect(getToolShortLabel("execute_command", t)).toBe("tool.actionBash");
  });

  it("maps read to tool.actionRead", () => {
    expect(getToolShortLabel("read", t)).toBe("tool.actionRead");
  });

  it("maps read_file to tool.actionRead", () => {
    expect(getToolShortLabel("read_file", t)).toBe("tool.actionRead");
  });

  it("maps write to tool.actionWrite", () => {
    expect(getToolShortLabel("write", t)).toBe("tool.actionWrite");
  });

  it("maps write_file to tool.actionWrite", () => {
    expect(getToolShortLabel("write_file", t)).toBe("tool.actionWrite");
  });

  it("maps edit to tool.actionEdit", () => {
    expect(getToolShortLabel("edit", t)).toBe("tool.actionEdit");
  });

  it("maps edit_file to tool.actionEdit", () => {
    expect(getToolShortLabel("edit_file", t)).toBe("tool.actionEdit");
  });

  it("maps grep to tool.actionGrep", () => {
    expect(getToolShortLabel("grep", t)).toBe("tool.actionGrep");
  });

  it("maps glob to tool.actionGlob", () => {
    expect(getToolShortLabel("glob", t)).toBe("tool.actionGlob");
  });

  // ── web tools ──

  it("maps websearch to tool.actionWebSearch", () => {
    expect(getToolShortLabel("websearch", t)).toBe("tool.actionWebSearch");
  });

  it("maps webfetch to tool.actionWebFetch", () => {
    expect(getToolShortLabel("webfetch", t)).toBe("tool.actionWebFetch");
  });

  // ── browser tools ──

  it("maps internal_browser_navigate to tool.actionBrowserNavigate", () => {
    expect(getToolShortLabel("internal_browser_navigate", t)).toBe(
      "tool.actionBrowserNavigate",
    );
  });

  it("maps internal_browser_screenshot to tool.actionBrowserScreenshot", () => {
    expect(getToolShortLabel("internal_browser_screenshot", t)).toBe(
      "tool.actionBrowserScreenshot",
    );
  });

  it("maps internal_browser_click to tool.actionBrowserClick", () => {
    expect(getToolShortLabel("internal_browser_click", t)).toBe(
      "tool.actionBrowserClick",
    );
  });

  it("maps internal_browser_snapshot to tool.actionBrowserSnapshot", () => {
    expect(getToolShortLabel("internal_browser_snapshot", t)).toBe(
      "tool.actionBrowserSnapshot",
    );
  });

  // ── MCP tools ──

  it("extracts tool name from mcp__Server__toolName", () => {
    expect(getToolShortLabel("mcp__CodeGraph__codegraph_search", t)).toBe(
      "codegraph_search",
    );
  });

  it("returns raw name for MCP tool without expected pattern", () => {
    expect(getToolShortLabel("mcp__singleword", t)).toBe("mcp__singleword");
  });

  // ── case insensitivity ──

  it("matches bash regardless of casing", () => {
    expect(getToolShortLabel("BASH", t)).toBe("tool.actionBash");
    expect(getToolShortLabel("Bash", t)).toBe("tool.actionBash");
  });

  // ── unknown tools ──

  it("returns raw name for unknown tool", () => {
    expect(getToolShortLabel("unknown_tool", t)).toBe("unknown_tool");
  });

  it("returns raw name for empty string", () => {
    expect(getToolShortLabel("", t)).toBe("");
  });
});
