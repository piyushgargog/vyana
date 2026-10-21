import { describe, expect, it } from "vitest";

import { E_RAKTKOSH_URL, cleanSearchText, labSearchLinks, pharmacySearchLinks, smsShareUrl, whatsappShareUrl } from "./source-links";

describe("pharmacySearchLinks", () => {
  it("gives one search link for each of the four pharmacies, with the name typed in", () => {
    const links = pharmacySearchLinks("Dolo 650");
    expect(links.map((l) => l.id)).toEqual(["1mg", "pharmeasy", "netmeds", "apollo"]);
    expect(links[0]?.url).toBe("https://www.1mg.com/search/all?name=Dolo%20650");
    expect(links[3]?.url).toBe("https://www.apollopharmacy.in/search-medicines/Dolo%20650");
    for (const l of links) expect(new URL(l.url).protocol).toBe("https:");
  });

  it("encodes characters that would change the address, and cuts a very long name", () => {
    const [first] = pharmacySearchLinks("a&b=c/d?e#f  g");
    expect(first?.url).toBe("https://www.1mg.com/search/all?name=a%26b%3Dc%2Fd%3Fe%23f%20g");
    expect(cleanSearchText("x".repeat(200))).toHaveLength(80);
  });

  it("gives no links for an empty name", () => {
    expect(pharmacySearchLinks("   ")).toEqual([]);
    expect(labSearchLinks("")).toEqual([]);
  });
});

describe("labSearchLinks", () => {
  it("searches only where a search page was checked, and opens the home page of the others", () => {
    const links = labSearchLinks("HbA1c");
    expect(links.map((l) => [l.id, l.searchesTest])).toEqual([
      ["1mg_labs", true],
      ["redcliffe", true],
      ["healthians", false],
      ["thyrocare", false],
    ]);
    expect(links[1]?.url).toBe("https://redcliffelabs.com/search?q=HbA1c");
    expect(links[2]?.url).toBe("https://www.healthians.com/");
  });
});

describe("share and blood links", () => {
  it("points to the public e-RaktKosh stock page", () => {
    expect(new URL(E_RAKTKOSH_URL).hostname).toBe("eraktkosh.mohfw.gov.in");
  });

  it("puts the message into a WhatsApp and an SMS link", () => {
    expect(whatsappShareUrl("Blood needed\nGroup: B-")).toBe("https://wa.me/?text=Blood%20needed%0AGroup%3A%20B-");
    expect(smsShareUrl("Blood needed")).toBe("sms:?body=Blood%20needed");
  });
});
