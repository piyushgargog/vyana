import type { BasketCompareRes, BasketLine } from "../contracts";

// Mock prices only. Real prices always come from the pharmacy pages (plan §2A).
const line = (medicine: string, strength: string, product_name: string, pack_size: string, unit_price: number | null, url: string | null, in_stock: boolean | null = true): BasketLine => ({
  medicine, strength, quantity: 1, product_name, pack_size, unit_price, line_total: unit_price, in_stock, product_url: url,
});

export const basketCompareMock: BasketCompareRes = {
  baskets: [
    {
      source: "pharmeasy", status: "ok", total: 247.4, missing: [], checkout_url: "https://pharmeasy.in",
      lines: [
        line("Metformin", "500 mg", "Glycomet 500 SR Tablet", "strip of 20 tablets", 31.5, "https://pharmeasy.in/search/all?name=metformin%20500"),
        line("Telma", "40 mg", "Telma 40 Tablet", "strip of 30 tablets", 187, "https://pharmeasy.in/search/all?name=telma%2040"),
        line("Dolo", "650 mg", "Dolo 650 Tablet", "strip of 15 tablets", 28.9, "https://pharmeasy.in/search/all?name=dolo%20650"),
      ],
    },
    {
      source: "1mg", status: "ok", total: 261.6, missing: [], checkout_url: "https://www.1mg.com",
      lines: [
        line("Metformin", "500 mg", "Glycomet 500 SR Tablet", "strip of 20 tablets", 33.1, "https://www.1mg.com/search/all?name=metformin%20500"),
        line("Telma", "40 mg", "Telma 40 Tablet", "strip of 30 tablets", 198, "https://www.1mg.com/search/all?name=telma%2040"),
        line("Dolo", "650 mg", "Dolo 650 Tablet", "strip of 15 tablets", 30.5, "https://www.1mg.com/search/all?name=dolo%20650"),
      ],
    },
    {
      source: "netmeds", status: "partial", total: 63.2, missing: ["Telma 40 mg"], checkout_url: "https://www.netmeds.com",
      lines: [
        line("Metformin", "500 mg", "Glycomet 500mg SR Strip Of 20 Tablets", "strip of 20 tablets", 32, "https://www.netmeds.com/catalogsearch/result/metformin%20500/all"),
        { medicine: "Telma", strength: "40 mg", quantity: 1, product_name: null, pack_size: null, unit_price: null, line_total: null, in_stock: null, product_url: null },
        line("Dolo", "650 mg", "Dolo 650mg Strip Of 15 Tablets", "strip of 15 tablets", 31.2, "https://www.netmeds.com/catalogsearch/result/dolo%20650/all"),
      ],
    },
    { source: "apollo", status: "timeout", total: null, missing: [], checkout_url: null, lines: [] },
  ],
  cheapest_source: "pharmeasy",
  generic: {
    total: 61,
    lines: [
      line("Metformin", "500 mg", "Metformin Hydrochloride Tablets IP 500 mg", "strip of 10 tablets", 14, "https://janaushadhi.gov.in", null),
      line("Telma", "40 mg", "Telmisartan Tablets IP 40 mg", "strip of 10 tablets", 35, "https://janaushadhi.gov.in", null),
      line("Dolo", "650 mg", "Paracetamol Tablets IP 650 mg", "strip of 10 tablets", 12, "https://janaushadhi.gov.in", null),
    ],
  },
  savings_vs_highest: 14.2,
  cached: false,
};
