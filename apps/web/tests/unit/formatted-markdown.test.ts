import { describe, expect, it } from "vitest";
import React from "react";
import { renderInlineMarkdown, FormattedMarkdown } from "@/app/(app)/assistant/formatted-markdown";

describe("renderInlineMarkdown", () => {
  it("leaves plain text untouched", () => {
    const res = renderInlineMarkdown("A simple diet.");
    expect(res).toEqual(["A simple diet."]);
  });

  it("parses **bold** and __bold__", () => {
    const res = renderInlineMarkdown("Eat **whole grains** and __fresh fruit__.");
    expect(res).toHaveLength(5);
    expect(res[0]).toBe("Eat ");
    expect(React.isValidElement(res[1])).toBe(true);
    expect((res[1] as React.ReactElement).type).toBe("strong");
    expect((res[1] as React.ReactElement<{ children: string }>).props.children).toBe("whole grains");
    expect(res[2]).toBe(" and ");
    expect(React.isValidElement(res[3])).toBe(true);
    expect((res[3] as React.ReactElement<{ children: string }>).props.children).toBe("fresh fruit");
    expect(res[4]).toBe(".");
  });

  it("parses `inline code` and *italic*", () => {
    const res = renderInlineMarkdown("Check `HbA1c` *regularly*.");
    expect(res).toHaveLength(5);
    expect(res[0]).toBe("Check ");
    expect(React.isValidElement(res[1])).toBe(true);
    expect((res[1] as React.ReactElement).type).toBe("code");
    expect((res[1] as React.ReactElement<{ children: string }>).props.children).toBe("HbA1c");
    expect(res[2]).toBe(" ");
    expect(React.isValidElement(res[3])).toBe(true);
    expect((res[3] as React.ReactElement).type).toBe("em");
    expect((res[3] as React.ReactElement<{ children: string }>).props.children).toBe("regularly");
    expect(res[4]).toBe(".");
  });
});

describe("renderInlineMarkdown: safety and half-written text", () => {
  it("keeps HTML and image syntax as plain text, never as elements", () => {
    for (const text of ["<script>alert(1)</script>", '<img src=x onerror="alert(1)">', "![x](https://evil.example/a.png)"]) {
      const res = renderInlineMarkdown(text);
      expect(res.every((n) => typeof n === "string")).toBe(true);
      expect(res.join("")).toBe(text);
    }
  });

  it("an unclosed marker stays as typed and does not swallow the rest", () => {
    expect(renderInlineMarkdown("Take **care and rest")).toEqual(["Take **care and rest"]);
    expect(renderInlineMarkdown("Use `code and more")).toEqual(["Use `code and more"]);
  });

  it("does not italicise snake_case_names or a multiplication", () => {
    expect(renderInlineMarkdown("the snake_case_var is plain")).toEqual(["the snake_case_var is plain"]);
    expect(renderInlineMarkdown("2 * 3 * 4 = 24")).toEqual(["2 * 3 * 4 = 24"]);
  });

  it("scans long input in linear time", () => {
    const t = Date.now();
    renderInlineMarkdown("*a ".repeat(20_000));
    renderInlineMarkdown("_x ".repeat(20_000));
    expect(Date.now() - t).toBeLessThan(1500);
  });
});

describe("FormattedMarkdown headings", () => {
  it("never becomes an h1, and a heading line with a long run of spaces is fast", () => {
    const t = Date.now();
    const el = FormattedMarkdown({ text: `# Title\n\n#${" ".repeat(20_000)}\r` } as never);
    expect(Date.now() - t).toBeLessThan(1500);
    expect(JSON.stringify(el)).toContain('"aria-level":2');
    expect(JSON.stringify(el)).not.toContain("<h1");
  });
});

describe("FormattedMarkdown", () => {
  it("renders a markdown table with header and rows", () => {
    const tableMd = `
| Group | Recommendation |
| --- | --- |
| Fruits | 2 servings |
| Vegetables | 3 servings |
`.trim();

    const element = FormattedMarkdown({ text: tableMd });
    expect(React.isValidElement(element)).toBe(true);
    const children = element.props.children;
    expect(children).toHaveLength(1); // One table block
    const tableBlock = children[0];
    expect(tableBlock.props.children.type).toBe("table");
  });

  it("renders bulleted lists", () => {
    const listMd = `
* First bullet
* Second bullet with **bold** text
`.trim();

    const element = FormattedMarkdown({ text: listMd });
    const children = element.props.children;
    expect(children).toHaveLength(1);
    const ulBlock = children[0];
    expect(ulBlock.type).toBe("ul");
    expect(ulBlock.props.children).toHaveLength(2);
  });

  it("renders numbered lists", () => {
    const listMd = `
1. Drink water
2. Exercise daily
`.trim();

    const element = FormattedMarkdown({ text: listMd });
    const children = element.props.children;
    expect(children).toHaveLength(1);
    const olBlock = children[0];
    expect(olBlock.type).toBe("ol");
    expect(olBlock.props.children).toHaveLength(2);
  });

  it("renders headings", () => {
    const headingMd = `
### Daily Recommendations
Follow these steps.
`.trim();

    const element = FormattedMarkdown({ text: headingMd });
    const children = element.props.children;
    expect(children).toHaveLength(2);
    expect(children[0].props.role).toBe("heading");
    expect(children[1].type).toBe("p");
  });

  it("handles empty or whitespace-only markdown gracefully", () => {
    for (const emptyText of ["", "   ", "\n\n", " \t \n \r "]) {
      const element = FormattedMarkdown({ text: emptyText });
      expect(React.isValidElement(element)).toBe(true);
      expect(element.props.children).toHaveLength(0);
    }
  });

  it("handles malformed markdown without crashing", () => {
    // Malformed table without delimiter row falls back to paragraph
    const badTable = "| Column 1 | Column 2 |\nNot a delimiter\n| Row 1 | Row 2 |";
    const elTable = FormattedMarkdown({ text: badTable });
    expect(React.isValidElement(elTable)).toBe(true);
    expect(JSON.stringify(elTable)).not.toContain("<table");

    // Uneven cells in table rows
    const unevenTable = `
| Test | Normal Range | Notes |
| --- | --- | --- |
| HbA1c | < 5.7% |
| Fasting Glucose | 70-99 mg/dL | Fasting 8-12h required | Normal |
`.trim();
    const elUneven = FormattedMarkdown({ text: unevenTable });
    expect(React.isValidElement(elUneven)).toBe(true);
    expect(JSON.stringify(elUneven)).toContain('"type":"table"');

    // Incomplete or trailing markdown tokens
    const halfTokens = "# \n**\n__\n`\n* \n- ";
    const elTokens = FormattedMarkdown({ text: halfTokens });
    expect(React.isValidElement(elTokens)).toBe(true);
  });

  it("renders formatting nested within list items and tables", () => {
    const richMd = `
| Nutrient | **Daily Goal** |
| --- | --- |
| Protein | \`60g\` |

* Focus on **complex carbohydrates**
* Avoid \`trans-fats\` and *added sugars*
`.trim();

    const element = FormattedMarkdown({ text: richMd });
    const children = element.props.children;
    expect(children).toHaveLength(2); // Table and List
    expect(children[0].props.children.type).toBe("table");
    expect(children[1].type).toBe("ul");

    const json = JSON.stringify(element);
    expect(json).toContain('"type":"strong"');
    expect(json).toContain('"type":"code"');
    expect(json).toContain('"type":"em"');
  });
});
