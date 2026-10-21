// W1 (#295): the basket and lab screens no longer price anything. They show buttons built from the
// @vyana/shared lookup helpers: a medicine gets "Search on <pharmacy>" on all four shops, a test gets
// "Search on <lab>" where the lab has a checked search page and "Open <lab>" where it does not.
import { describe, expect, it } from "vitest";
import { labSearchLinks, pharmacySearchLinks } from "@vyana/shared";

const pharmacyButtonLabel = (name: string) => `Search on ${name}`;
const labButtonLabel = (link: { name: string; searchesTest: boolean }) =>
  link.searchesTest ? `Search on ${link.name}` : `Open ${link.name}`;

describe("medicine lookup buttons (basket, web and phone)", () => {
  const medicines = ["Dolo 650", "Metformin 500mg", "Atorvastatin 10mg"];
  for (const medicine of medicines) {
    it(`opens the right search for ${medicine} on all four pharmacies`, () => {
      const links = pharmacySearchLinks(medicine);
      expect(links.map((l) => pharmacyButtonLabel(l.name))).toEqual([
        "Search on Tata 1mg",
        "Search on PharmEasy",
        "Search on Netmeds",
        "Search on Apollo Pharmacy",
      ]);
      const q = encodeURIComponent(medicine);
      expect(links.map((l) => l.url)).toEqual([
        `https://www.1mg.com/search/all?name=${q}`,
        `https://pharmeasy.in/search/all?name=${q}`,
        `https://www.netmeds.com/products?q=${q}`,
        `https://www.apollopharmacy.in/search-medicines/${q}`,
      ]);
    });
  }

  it("shows no buttons for an empty medicine name", () => {
    expect(pharmacySearchLinks("   ")).toEqual([]);
  });
});

describe("lab lookup buttons (labs-compare and the web report link)", () => {
  const tests = ["HbA1c", "Lipid Profile", "Vitamin D3"];
  for (const test of tests) {
    it(`labels the four labs right for ${test}`, () => {
      const links = labSearchLinks(test);
      expect(links.map((l) => labButtonLabel(l))).toEqual([
        "Search on Tata 1mg Labs",
        "Search on Redcliffe Labs",
        "Open Healthians",
        "Open Thyrocare",
      ]);
      const q = encodeURIComponent(test);
      // The two searchable labs carry the test name; the other two open the home page.
      expect(links[0]?.url).toBe(
        `https://www.1mg.com/search/all?name=${q}&filter=true&type=labs`
      );
      expect(links[1]?.url).toBe(`https://redcliffelabs.com/search?q=${q}`);
      expect(links[2]?.url).toBe("https://www.healthians.com/");
      expect(links[3]?.url).toBe("https://www.thyrocare.com/");
    });
  }
});
