import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PharmacyBasket } from "@vyana/shared";

const fetchPagesMock = vi.fn();
vi.mock("@/lib/server/tinyfish/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/tinyfish/client")>()),
  fetchPages: (...args: unknown[]) => fetchPagesMock(...args),
}));

const { basketGoal, basketKey, normalizeItems, plausiblePrice, pricesOnPage, processPharmacyResult, summarize, BASKET_OUTPUT_SCHEMA } =
  await import("@/lib/server/tinyfish/basket");
const { PHARMACIES } = await import("@/lib/server/tinyfish/sources");

const apollo = PHARMACIES.find((p) => p.source === "apollo")!;
const netmeds = PHARMACIES.find((p) => p.source === "netmeds")!;
const items = normalizeItems([
  { medicine: "Dolo", strength: "650 mg" },
  { medicine: "Telma", strength: "40 mg", quantity: 2 },
]);

/** Fetch returns these page texts by URL. */
function pages(texts: Record<string, string>) {
  fetchPagesMock.mockImplementation(async ({ urls }: { urls: string[] }) => ({
    results: urls.filter((u) => u in texts).map((u) => ({ url: u, text: texts[u] })),
    errors: urls.filter((u) => !(u in texts)).map((u) => ({ url: u, error: "bot_blocked" })),
  }));
}

// A block body: a function returned from beforeEach would be run as a teardown.
beforeEach(() => {
  fetchPagesMock.mockReset();
});

describe("basket input", () => {
  it("gives the same key for the same basket in any order or spacing", () => {
    const a = basketKey(normalizeItems([{ medicine: "Dolo", strength: "650 mg" }, { medicine: "Telma", strength: "40 mg" }]));
    const b = basketKey(normalizeItems([{ medicine: " telma ", strength: "40  MG" }, { medicine: "DOLO", strength: "650 mg", quantity: 1 }]));
    expect(a).toBe(b);
    expect(basketKey(normalizeItems([{ medicine: "Dolo", strength: "650 mg", quantity: 2 }]))).not.toBe(
      basketKey(normalizeItems([{ medicine: "Dolo", strength: "650 mg" }])),
    );
  });

  it("numbers every medicine in the goal and forbids login, cart and purchase", () => {
    const goal = basketGoal(items, netmeds);
    expect(goal).toContain("1. Dolo 650 mg (search results: https://www.netmeds.com/products?q=Dolo%20650%20mg)");
    expect(goal).toContain("2. Telma 40 mg");
    expect(goal).toContain("Do NOT log in");
  });

  it("uses only schema keywords the agent API accepts", () => {
    const allowed = new Set(["type", "properties", "required", "items", "minimum", "maximum", "nullable", "enum", "format", "minItems", "maxItems", "anyOf", "propertyOrdering"]);
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      for (const [k, v] of Object.entries(node)) {
        expect(allowed.has(k), k).toBe(true);
        if (k === "properties") Object.values(v as object).forEach(walk);
        else if (k !== "required" && k !== "enum") walk(v); // those hold names, not schemas
      }
    };
    walk(BASKET_OUTPUT_SCHEMA);
  });
});

describe("price checks", () => {
  it("accepts believable prices only", () => {
    expect(plausiblePrice(28.3, 32.28)).toBe(28.3);
    expect(plausiblePrice(0, 32)).toBeNull();
    expect(plausiblePrice(-5, null)).toBeNull();
    expect(plausiblePrice(400, 32)).toBeNull();
    expect(plausiblePrice(4999, null)).toBe(4999);
    expect(plausiblePrice(6000, null)).toBeNull();
    expect(plausiblePrice(Number.NaN, null)).toBeNull();
  });

  it("reads amounts written after a currency marker", () => {
    const set = pricesOnPage("Price ₹22.66 MRP: ₹32.28 | Rs. 1,200 | INR 99 | mrp 45.5 | pack of 15 | open 24 hours 7 days");
    expect([...set].sort((a, b) => a - b)).toEqual([22.66, 32.28, 45.5, 99, 1200]);
  });

  it("treats 32 and 32.00 as the same amount", () => {
    expect(pricesOnPage("₹32.00").has(32)).toBe(true);
  });

  it("ignores letters that only end with a marker", () => {
    expect(pricesOnPage("hours 15 / colours 20").size).toBe(0);
  });
});

describe("processPharmacyResult", () => {
  it("resolves relative links, confirms prices on the page and totals confirmed lines", async () => {
    pages({
      "https://www.apollopharmacy.in/otc/dolo-650": "Dolo 650 Tablet ₹32.00",
      "https://www.apollopharmacy.in/otc/telma-40": "Telma 40 MRP ₹ 198",
    });
    const b = await processPharmacyResult(apollo, items, {
      items: [
        { index: 1, found: true, product_name: "Dolo-650 Tablet", pack_size: "15", price: 32, mrp: 32, in_stock: true, product_url: "/otc/dolo-650" },
        { index: 2, found: true, product_name: "Telma 40", pack_size: "30", price: 198, mrp: 210, in_stock: true, product_url: "https://www.apollopharmacy.in/otc/telma-40" },
      ],
    });
    expect(b.status).toBe("ok");
    expect(b.lines.map((l) => [l.product_url, l.price_verified, l.line_total])).toEqual([
      ["https://www.apollopharmacy.in/otc/dolo-650", true, 32],
      ["https://www.apollopharmacy.in/otc/telma-40", true, 396],
    ]);
    expect(b.total).toBe(428);
    expect(b.checkout_url).toBe(apollo.homeUrl);
    expect(fetchPagesMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a price the page doesn't show, but unconfirmed and out of the total", async () => {
    pages({ "https://www.netmeds.com/product/dolo": "Dolo 650 Tablet 15's MRP ₹25.18", "https://www.netmeds.com/product/telma": "Telma ₹190" });
    const b = await processPharmacyResult(netmeds, items, {
      items: [
        { index: 1, found: true, product_name: "Dolo 650", price: 22.66, mrp: 32.28, product_url: "https://www.netmeds.com/product/dolo" },
        { index: 2, found: true, product_name: "Telma 40", price: 190, mrp: 200, product_url: "https://www.netmeds.com/product/telma" },
      ],
    });
    expect(b.status).toBe("partial");
    expect(b.lines[0]).toMatchObject({ unit_price: 22.66, price_verified: false, line_total: null });
    expect(b.total).toBe(380);
    expect(b.missing).toEqual([]);
  });

  it("drops a product link on another site and reports the medicine as missing", async () => {
    pages({ "https://www.netmeds.com/product/telma": "₹190" });
    const b = await processPharmacyResult(netmeds, items, {
      items: [
        { index: 1, found: true, product_name: "Dolo", price: 30, product_url: "https://evil.example/dolo" },
        { index: 2, found: true, product_name: "Telma 40", price: 190, product_url: "https://www.netmeds.com/product/telma" },
      ],
    });
    expect(b.missing).toEqual(["Dolo 650 mg"]);
    expect(b.lines[0].product_url).toBeNull();
    expect(b.status).toBe("partial");
  });

  it("treats a failed page fetch as unconfirmed, never as confirmed", async () => {
    fetchPagesMock.mockRejectedValue(new Error("network"));
    const b = await processPharmacyResult(netmeds, items.slice(0, 1), {
      items: [{ index: 1, found: true, product_name: "Dolo", price: 30, product_url: "https://www.netmeds.com/product/dolo" }],
    });
    expect(b.lines[0].price_verified).toBe(false);
    expect(b.total).toBeNull();
    expect(b.status).toBe("partial");
  });

  it("reports not_found when nothing matched, and error for a malformed result", async () => {
    pages({});
    expect((await processPharmacyResult(netmeds, items, { items: [{ index: 1, found: false }, { index: 2, found: false }] })).status).toBe("not_found");
    expect((await processPharmacyResult(netmeds, items, { nope: true })).status).toBe("error");
    expect(fetchPagesMock).not.toHaveBeenCalled();
  });
});

describe("summarize", () => {
  const b = (source: PharmacyBasket["source"], status: PharmacyBasket["status"], total: number | null): PharmacyBasket => ({
    source, status, total, lines: [], missing: [], checkout_url: null,
  });

  it("orders complete baskets by total, then partial, pending and failed ones", () => {
    const s = summarize([b("apollo", "timeout", null), b("1mg", "ok", 261.6), b("netmeds", "partial", 32), b("pharmeasy", "ok", 247.4), b("1mg_labs", "pending", null)]);
    expect(s.baskets.map((x) => x.source)).toEqual(["pharmeasy", "1mg", "netmeds", "1mg_labs", "apollo"]);
    expect(s.cheapest_source).toBe("pharmeasy");
    expect(s.savings_vs_highest).toBe(14.2);
    expect(s.status).toBe("running");
  });

  it("is done when nothing is pending, and has no savings with fewer than two complete baskets", () => {
    const s = summarize([b("1mg", "ok", 100), b("netmeds", "partial", 20)]);
    expect(s.status).toBe("done");
    expect(s.cheapest_source).toBe("1mg");
    expect(s.savings_vs_highest).toBeNull();
  });
});
