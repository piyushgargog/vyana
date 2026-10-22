import { describe, expect, it } from "vitest";
import {
  extractLinksFromText,
  getMessageText,
  isEmergencyReplyText,
  stripMarkdownLinks,
  toolActivityLabel,
  type AssistantMessage,
} from "@/app/(app)/assistant/chat-helpers";

const message = (parts: unknown[]) => ({ id: "m1", role: "assistant", parts }) as unknown as AssistantMessage;

describe("extractLinksFromText", () => {
  it("returns nothing for text without links", () => {
    expect(extractLinksFromText("Drink water.")).toEqual([]);
    expect(extractLinksFromText("")).toEqual([]);
  });

  it("finds one link, with a title that has spaces", () => {
    expect(extractLinksFromText("See [NHS: diabetes guide](https://www.nhs.uk/diabetes) for more.")).toEqual([
      { title: "NHS: diabetes guide", url: "https://www.nhs.uk/diabetes" },
    ]);
  });

  it("keeps the order of different links, http and https", () => {
    expect(extractLinksFromText("[a](http://a.example/x) and [b](https://b.example/y)")).toEqual([
      { title: "a", url: "http://a.example/x" },
      { title: "b", url: "https://b.example/y" },
    ]);
  });

  it("shows a repeated URL once, with the first title", () => {
    expect(extractLinksFromText("[first](https://a.example/x) then [second](https://a.example/x)")).toEqual([
      { title: "first", url: "https://a.example/x" },
    ]);
  });

  it("ignores every scheme except http and https", () => {
    expect(extractLinksFromText("[x](javascript:alert(1)) [y](ftp://a.example) [z](data:text/html,hi)")).toEqual([]);
  });

  it("stops the URL at the closing bracket", () => {
    expect(extractLinksFromText("(see [a](https://a.example/x)) done")).toEqual([{ title: "a", url: "https://a.example/x" }]);
  });
});

describe("stripMarkdownLinks", () => {
  it("replaces the markup by the title only", () => {
    expect(stripMarkdownLinks("See [NHS](https://www.nhs.uk) today.")).toBe("See NHS today.");
  });

  it("handles two links in a row", () => {
    expect(stripMarkdownLinks("[a](https://a.example)[b](https://b.example)")).toBe("ab");
  });

  it("leaves text without links unchanged", () => {
    expect(stripMarkdownLinks("No links here (really).")).toBe("No links here (really).");
  });

  it("gives the same result when called twice in a row (no shared regex state)", () => {
    const text = "[a](https://a.example) and [b](https://b.example)";
    expect(stripMarkdownLinks(text)).toBe("a and b");
    expect(stripMarkdownLinks(text)).toBe("a and b");
    expect(extractLinksFromText(text)).toHaveLength(2);
    expect(extractLinksFromText(text)).toHaveLength(2);
  });
});

describe("isEmergencyReplyText", () => {
  it.each([
    "If this is an emergency, call 108 now.",
    "IF THIS IS AN EMERGENCY, please get help.",
    "Please call 108 immediately.",
    "यह आपात स्थिति है, 108 पर कॉल करें",
    "Turant 108 par call karein",
  ])("is true for %s", (text) => {
    expect(isEmergencyReplyText(text)).toBe(true);
  });

  it.each(["Drink water and rest.", "", "Your dose is 1080 units per day in the label."])("is false for %s", (text) => {
    expect(isEmergencyReplyText(text)).toBe(false);
  });
});

describe("getMessageText", () => {
  it("joins the text parts in order", () => {
    expect(getMessageText(message([{ type: "text", text: "Hello " }, { type: "text", text: "there" }]))).toBe("Hello there");
  });

  it("ignores parts that are not text", () => {
    expect(getMessageText(message([{ type: "tool-read_page", state: "output-available" }, { type: "text", text: "Done" }]))).toBe("Done");
  });

  it("returns an empty string for a message without parts", () => {
    expect(getMessageText(message([]))).toBe("");
  });
});

describe("toolActivityLabel", () => {
  it("labels the web search and page reading tools", () => {
    expect(toolActivityLabel("tool-search_health_web")).toBe("Searching trusted sources…");
    expect(toolActivityLabel("tool-read_page")).toBe("Searching trusted sources…");
  });

  it("labels the price comparison tool", () => {
    expect(toolActivityLabel("tool-medicine_price_links")).toBe("Preparing pharmacy links…");
  });

  it("returns null for everything else", () => {
    expect(toolActivityLabel("text")).toBeNull();
    expect(toolActivityLabel("tool-unknown")).toBeNull();
    expect(toolActivityLabel("")).toBeNull();
  });
});
