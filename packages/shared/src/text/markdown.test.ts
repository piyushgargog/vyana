import { describe, expect, it } from "vitest";

import { parseInlineMarkdown, parseMarkdownBlocks } from "./markdown";

describe("parseInlineMarkdown", () => {
  it("reads **bold** without the asterisks", () => {
    expect(parseInlineMarkdown("your **average blood sugar level** is here")).toEqual([
      { kind: "text", text: "your " },
      { kind: "bold", text: "average blood sugar level" },
      { kind: "text", text: " is here" },
    ]);
  });

  it("reads italics and inline code", () => {
    expect(parseInlineMarkdown("a *light* walk, code `x`")).toEqual([
      { kind: "text", text: "a " },
      { kind: "italic", text: "light" },
      { kind: "text", text: " walk, code " },
      { kind: "code", text: "x" },
    ]);
  });

  it("leaves snake_case and sums as typed", () => {
    expect(parseInlineMarkdown("snake_case_name and 2 * 3 * 4")).toEqual([
      { kind: "text", text: "snake_case_name and 2 * 3 * 4" },
    ]);
  });

  it("turns a markdown https link into a link segment", () => {
    expect(parseInlineMarkdown("see [NHS](https://www.nhs.uk) now")).toEqual([
      { kind: "text", text: "see " },
      { kind: "link", text: "NHS", url: "https://www.nhs.uk" },
      { kind: "text", text: " now" },
    ]);
  });

  it("does not link other forms", () => {
    const segments = parseInlineMarkdown("[file](file:///etc) and www.example.com");
    expect(segments.every((s) => s.kind !== "link")).toBe(true);
  });
});

describe("parseMarkdownBlocks", () => {
  it("splits headings, paragraphs and bullet lists", () => {
    const blocks = parseMarkdownBlocks(
      ["## Your reports", "Two things stand out.", "- First **point**", "- Second point"].join("\n")
    );
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "bullet-list"]);
    const list = blocks[2];
    expect(list.kind === "bullet-list" && list.items).toHaveLength(2);
  });

  it("groups numbered items and keeps their order", () => {
    const blocks = parseMarkdownBlocks("1. One\n2. Two");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("numbered-list");
  });

  it("empty text gives no blocks", () => {
    expect(parseMarkdownBlocks("")).toEqual([]);
    expect(parseMarkdownBlocks("\n\n")).toEqual([]);
  });
});

describe("parseInlineMarkdown on hostile input", () => {
  it("stays fast on very long runs of brackets and half-open links (no polynomial backtracking)", () => {
    for (const input of ["[".repeat(60_000), "[!](http://".repeat(6_000), "[\](http://".repeat(6_000)]) {
      const started = performance.now();
      const out = parseInlineMarkdown(input);
      expect(performance.now() - started).toBeLessThan(500);
      expect(out.map((s) => ("text" in s ? s.text : "")).join("").length).toBeGreaterThan(0);
    }
  });

  it("still reads a normal link, and a label with a bracket is plain text", () => {
    expect(parseInlineMarkdown("see [MedlinePlus](https://medlineplus.gov/a) now")).toEqual([
      { kind: "text", text: "see " },
      { kind: "link", text: "MedlinePlus", url: "https://medlineplus.gov/a" },
      { kind: "text", text: " now" },
    ]);
    expect(parseInlineMarkdown("[a [b] c](https://x.test)").some((s) => s.kind === "link" && s.text === "a [b] c")).toBe(false);
  });
});
