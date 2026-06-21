import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function readFile(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");
}

describe("message card file attachment layout", () => {
  it("keeps user bubble shrinkable in flex layouts", () => {
    const source = readFile("../src/renderer/components/MessageCard.tsx");
    expect(source).toContain("max-w-[80%] min-w-0 break-words");
  });

  it("prevents file attachment row overflow with long filenames", () => {
    const source = readFile(
      "../src/renderer/components/message/ContentBlockView.tsx",
    );
    expect(source).toContain("max-w-full min-w-0");
    expect(source).toContain("overflow-hidden");
    expect(source).toContain("text-xs text-text-primary truncate");
  });

  it("keeps thinking rows aligned with tool rows and inline chevrons", () => {
    const source = readFile(
      "../src/renderer/components/message/ThinkingBlock.tsx",
    );
    expect(source).toContain(
      'Brain className="w-3.5 h-3.5 flex-shrink-0 pt-0.5 text-text-muted"',
    );
    expect(source).toContain(
      "min-w-0 flex flex-1 flex-wrap items-baseline gap-x-1 gap-y-0.5",
    );
    expect(source).toContain("break-words text-xs text-text-muted/60 italic");
    expect(source).toContain(
      "inline-flex w-3.5 flex-shrink-0 items-center justify-center self-start pt-0.5",
    );
    expect(source).toContain("aria-expanded={expanded}");
  });
});
