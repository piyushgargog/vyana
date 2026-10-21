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
});
