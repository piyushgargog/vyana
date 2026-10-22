import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { fetchPage, htmlToText } = await import("@/lib/server/web/fetch-page");
const { parseTopics, searchHealthTopics } = await import("@/lib/server/web/medlineplus");
const { isOnDomain, isTrustedHealthUrl } = await import("@/lib/server/web/domains");

const ALLOWED = ["medlineplus.gov", "nhs.uk"];
const PAGE_HTML = `<!doctype html><html><head><title>Type 2 diabetes &amp; you</title><style>p{color:red}</style></head><body>
<nav>Home | Topics | Login</nav><script>alert(1)</script>
<main><h1>Type 2 diabetes</h1><p>Type 2 diabetes is a long-term condition. Regular activity, such as a brisk walk every day, helps you stay well, and a balanced diet with vegetables and whole grains is part of looking after it.</p>
<ul><li>Walk every day</li><li>Eat vegetables &amp;lt;b&amp;gt;</li></ul></main><footer>Copyright</footer></body></html>`;

const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });

beforeEach(() => {
  vi.stubEnv("WEB_MOCK", "0"); // the real path with a stubbed network
  resetDb();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("htmlToText", () => {
  it("keeps the content, drops scripts, styles, navigation and footers, and decodes an entity only once", () => {
    const { title, text } = htmlToText(PAGE_HTML);
    expect(title).toBe("Type 2 diabetes & you");
    expect(text).toContain("# Type 2 diabetes");
    expect(text).toContain("- Walk every day");
    expect(text).toContain("- Eat vegetables &lt;b&gt;");
    expect(text).not.toMatch(/alert\(1\)|Login|Copyright|color:red/);
  });

  it("keeps the text after a script that contains < and > (a loop, an arrow function)", () => {
    const { text } = htmlToText("<p>before</p><script>for (let i = 0; i < n; i++) { f = (a) => a > 1 }</script><style>a > b { color: red }</style><p>after the script</p>");
    expect(text).toContain("before");
    expect(text).toContain("after the script");
    expect(text).not.toMatch(/for \(let|color: red/);
  });

  it("does not hang or throw on broken markup", () => {
    expect(htmlToText("<p>one <b>two").text).toBe("one two");
    expect(htmlToText("<div><script>never closed").text).toBe("");
    expect(htmlToText("x".repeat(100_000) + "<").text.length).toBeGreaterThan(0);
  });
});

describe("fetchPage", () => {
  it("reads an allowed page, caches it, and asks politely", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => html(PAGE_HTML));
    vi.stubGlobal("fetch", fetchFn);
    const page = await fetchPage("https://medlineplus.gov/diabetestype2.html", ALLOWED);
    expect(page).toMatchObject({ url: "https://medlineplus.gov/diabetestype2.html", title: "Type 2 diabetes & you" });
    expect(page?.text).toContain("brisk walk");
    const init = fetchFn.mock.calls[0]?.[1] as RequestInit;
    expect(String((init.headers as Record<string, string>)["User-Agent"])).toContain("Vyana");
    await fetchPage("https://medlineplus.gov/diabetestype2.html", ALLOWED);
    expect(fetchFn).toHaveBeenCalledTimes(1); // the second read came from the cache
  });

  it("does not hand a page to a caller whose list does not allow the host it really came from", async () => {
    const fetchFn = vi.fn<typeof fetch>(async (url) =>
      String(url).startsWith("https://nhm.gov.in/") ? html(PAGE_HTML) : new Response(null, { status: 301, headers: { location: "https://nhm.gov.in/page" } }),
    );
    vi.stubGlobal("fetch", fetchFn);
    const wide = ["medlineplus.gov", "nhm.gov.in"];
    expect(await fetchPage("https://medlineplus.gov/moved", wide)).not.toBeNull(); // the first caller's list allows both hosts
    expect(await fetchPage("https://medlineplus.gov/moved", ["medlineplus.gov"])).toBeNull(); // the narrower list does not allow nhm.gov.in
  });

  it("refuses a body that is too big, on the header or while reading", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => html("x", 200, { "content-length": "99000000" })));
    expect(await fetchPage("https://nhs.uk/huge", ALLOWED)).toBeNull();
    const big = "<p>" + "word ".repeat(700_000) + "</p>";
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => html(big)));
    expect(await fetchPage("https://nhs.uk/big", ALLOWED)).toBeNull();
  });

  it("never fetches a host that is not on the list, or a non-https address", async () => {
    const fetchFn = vi.fn(async () => html(PAGE_HTML));
    vi.stubGlobal("fetch", fetchFn);
    expect(await fetchPage("https://healthblog.example/medlineplus.gov", ALLOWED)).toBeNull();
    expect(await fetchPage("https://medlineplus.gov.evil.example/x", ALLOWED)).toBeNull();
    expect(await fetchPage("http://medlineplus.gov/x", ALLOWED)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("follows a redirect inside the list and refuses one that leaves it", async () => {
    const fetchFn = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.endsWith("/old")) return new Response(null, { status: 301, headers: { location: "/new" } });
      if (u.endsWith("/new")) return html(PAGE_HTML);
      return new Response(null, { status: 302, headers: { location: "https://evil.example/steal" } });
    });
    vi.stubGlobal("fetch", fetchFn);
    expect((await fetchPage("https://nhs.uk/old", ALLOWED))?.url).toBe("https://nhs.uk/old"); // the page the caller asked for
    expect(await fetchPage("https://nhs.uk/away", ALLOWED)).toBeNull();
    expect(fetchFn.mock.calls.map((c) => String(c[0]))).not.toContain("https://evil.example/steal");
  });

  it("returns null for errors, non-text content and pages with almost no text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    expect(await fetchPage("https://nhs.uk/missing", ALLOWED)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } })));
    expect(await fetchPage("https://nhs.uk/file.pdf", ALLOWED)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => html("<p>short</p>")));
    expect(await fetchPage("https://nhs.uk/tiny", ALLOWED)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect(await fetchPage("https://nhs.uk/down", ALLOWED)).toBeNull();
  });
});

describe("domains", () => {
  it("matches the host or a subdomain only", () => {
    expect(isOnDomain("https://www.nhs.uk/conditions/", "nhs.uk")).toBe(true);
    expect(isOnDomain("https://nhs.uk.evil.example/", "nhs.uk")).toBe(false);
    expect(isTrustedHealthUrl("https://medlineplus.gov/a.html")).toBe(true);
    expect(isTrustedHealthUrl("https://random.example/medlineplus.gov")).toBe(false);
  });
});

const XML = `<?xml version="1.0" encoding="UTF-8"?><nlmSearchResult><term>diabetes</term><count>2</count><list num="3" start="0" per="3">
<document rank="0" url="https://medlineplus.gov/diabetestype2.html"><content name="title">&lt;span class="qt3"&gt;Diabetes&lt;/span&gt; Type 2</content><content name="FullSummary">&lt;p&gt;Diabetes means your blood glucose is too high.&lt;/p&gt;</content></document>
<document rank="1" url="https://evil.example/diabetes.html"><content name="title">Not ours</content></document>
<document rank="2" url="https://medlineplus.gov/diabetesinchildrenandteens.html"><content name="title">Diabetes in Children and Teens</content></document>
</list></nlmSearchResult>`;

describe("MedlinePlus topic search", () => {
  it("reads the topics, strips the service's markup and keeps only medlineplus.gov pages", () => {
    const topics = parseTopics(XML, 5);
    expect(topics.map((t) => [t.title, t.url])).toEqual([
      ["Diabetes Type 2", "https://medlineplus.gov/diabetestype2.html"],
      ["Diabetes in Children and Teens", "https://medlineplus.gov/diabetesinchildrenandteens.html"],
    ]);
    expect(topics[0]?.snippet).toBe("Diabetes means your blood glucose is too high.");
    expect(parseTopics(XML, 1)).toHaveLength(1);
    expect(parseTopics("<broken", 3)).toEqual([]);
  });

  it("asks the service once per query (cached), and answers an empty list when it is down", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(XML, { status: 200, headers: { "content-type": "text/xml" } }));
    vi.stubGlobal("fetch", fetchFn);
    expect((await searchHealthTopics("type 2 diabetes", 3)).length).toBe(2);
    await searchHealthTopics(" Type 2   Diabetes ", 3);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("term=type%202%20diabetes");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    expect(await searchHealthTopics("asthma", 3)).toEqual([]);
    expect(await searchHealthTopics("a", 3)).toEqual([]); // too short to search
  });
});
