import { describe, expect, it } from "vitest";
import type { TextStreamPart, ToolSet } from "ai";
import { ReplyGuard, readyLength } from "@/lib/server/assistant/guard";
import { historyFrom } from "@/lib/server/assistant/chat";
import { assistantTools } from "@/lib/server/assistant/tools";
import { isTrustedHealthUrl } from "@/lib/server/tinyfish/sources";

type Part = TextStreamPart<ToolSet>;

/** Runs text deltas (and a finish) through the guard's transform and returns what the user would see. */
async function through(guard: ReplyGuard, deltas: string[]): Promise<{ shown: string[]; parts: Part[] }> {
  const input: Part[] = [
    { type: "text-start", id: "t" } as Part,
    ...deltas.map((text) => ({ type: "text-delta", id: "t", text }) as Part),
    { type: "text-end", id: "t" } as Part,
    { type: "finish-step" } as Part,
    { type: "finish" } as Part,
  ];
  const transform = guard.transform()({ tools: {}, stopStream: () => {} } as never);
  const out: Part[] = [];
  const writer = transform.writable.getWriter();
  const reading = (async () => {
    const reader = transform.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      out.push(value);
    }
  })();
  for (const p of input) await writer.write(p);
  await writer.close();
  await reading;
  return { shown: out.filter((p) => p.type === "text-delta").map((p) => (p as { text: string }).text), parts: out };
}

const guardFor = (allowed: string[] = []) => {
  const g = new ReplyGuard({ language: "en", placeholders: { "[NAME_1]": "Asha" } });
  for (const u of allowed) g.allow(u, "MedlinePlus");
  return g;
};

describe("readyLength", () => {
  it("holds the last word, which may still become a link", () => {
    expect(readyLength("see https://medline")).toBe(4);
    expect(readyLength("nothing complete")).toBe(8);
    expect(readyLength("word")).toBe(0);
  });
  it("holds an unfinished markdown link from its '['", () => {
    expect(readyLength("Read [the NHS page on ")).toBe(5);
    expect(readyLength("Read [NHS](https://nhs.uk/x")).toBe(5);
    expect(readyLength("Read [NHS](https://nhs.uk/x) now ")).toBe(33);
    expect(readyLength("Reference [1] here ")).toBe(19);
  });
  it("doesn't hold a stray '[' forever", () => {
    const long = `[${"word ".repeat(200)}`;
    expect(readyLength(long)).toBe(long.length);
  });
});

describe("ReplyGuard", () => {
  it("shows a fetched link even when it arrives in pieces", async () => {
    const { shown } = await through(guardFor(["https://medlineplus.gov/a"]), ["See [MedlinePlus](https://medline", "plus.gov/a) for more. "]);
    expect(shown.join("")).toBe("See [MedlinePlus](https://medlineplus.gov/a) for more. ");
  });

  it("drops a link that wasn't fetched and keeps the label", async () => {
    const g = guardFor();
    const { shown } = await through(g, ["See [MedlinePlus](https://medline", "plus.gov/a) for more. "]);
    expect(shown.join("")).toBe("See MedlinePlus for more. ");
    expect(g.removed).toEqual(["https://medlineplus.gov/a"]);
    expect(g.needsReview).toBe(true);
  });

  it("never lets part of an unfetched URL through", async () => {
    const { shown } = await through(guardFor(), ["Go to https://evil", ".example/", "steal now"]);
    expect(shown.join("")).toBe("Go to now");
  });

  it("restores placeholders, even split across deltas", async () => {
    const { shown } = await through(guardFor(), ["Hi [NA", "ME_1], welcome. "]);
    expect(shown.join("")).toBe("Hi Asha, welcome. ");
  });

  it("passes step events straight through (streamText waits for them) and leaves the notes to the caller", async () => {
    const g = guardFor();
    const { parts } = await through(g, ["You could double the dose. "]);
    expect(parts.map((p) => p.type).slice(-2)).toEqual(["finish-step", "finish"]);
    expect(g.closingNotes()).toContain("asking your doctor");
    expect(g.text).toContain("asking your doctor");
  });

  it("records the links that were shown as the run's sources", async () => {
    const g = guardFor(["https://medlineplus.gov/a"]);
    await through(g, ["Per https://medlineplus.gov/a and https://medlineplus.gov/a/ again. "]);
    expect(g.sources).toEqual([{ title: "MedlinePlus", url: "https://medlineplus.gov/a" }]);
    expect(g.needsReview).toBe(false);
  });

  it("needs no source for a reply built from the user's own records", async () => {
    const g = guardFor();
    g.noteToolCall("get_my_lab_values");
    await through(g, [`${"Your HbA1c was 7.4 on 5 Oct, above the 4.0 to 5.6 range. ".repeat(5)}`]);
    expect(g.closingNotes()).toBe("");
  });
});

describe("historyFrom", () => {
  const m = (role: string, text: string) => ({ role, parts: [{ type: "text", text }] });
  it("keeps only user and assistant text, the last 20", () => {
    const msgs = [m("system", "rules"), ...Array.from({ length: 25 }, (_, i) => m(i % 2 ? "assistant" : "user", `t${i}`)), m("user", "last")];
    const h = historyFrom(msgs);
    expect(h).toHaveLength(20);
    expect(h.at(-1)).toEqual({ role: "user", text: "last" });
    expect(h.some((t) => t.text === "rules")).toBe(false);
  });
});

describe("assistant tools", () => {
  const tools = assistantTools({ userId: "u1", sb: {} as never, guard: guardFor(), counter: { tinyfishCalls: 0 } });
  const opts = { toolCallId: "c", messages: [] } as never;

  it("trusts only the listed health sites", () => {
    expect(isTrustedHealthUrl("https://medlineplus.gov/ency/article/001927.htm")).toBe(true);
    expect(isTrustedHealthUrl("https://www.who.int/news")).toBe(true);
    expect(isTrustedHealthUrl("https://who.int.evil.com/x")).toBe(false);
    expect(isTrustedHealthUrl("https://healthblog.com/medlineplus.gov")).toBe(false);
  });

  it("read_page refuses pages outside the trusted list", async () => {
    const out = await tools.read_page.execute!({ url: "https://healthblog.example/dolo" }, opts);
    expect(out).toMatchObject({ error: expect.stringContaining("Only these sites") });
  });

  it("search_health_web only searches trusted sites and registers the results", async () => {
    const guard = guardFor();
    const t = assistantTools({ userId: "u1", sb: {} as never, guard, counter: { tinyfishCalls: 0 } });
    const out = (await t.search_health_web.execute!({ query: "dolo alcohol" }, opts)) as { results: { url: string }[] };
    expect(out.results.every((r) => isTrustedHealthUrl(r.url))).toBe(true);
    guard.clean(`${out.results[0].url} `);
    expect(guard.removed).toEqual([]);
  });
});
