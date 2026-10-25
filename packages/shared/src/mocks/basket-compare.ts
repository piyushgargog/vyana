import type { BasketCompareRes, BasketLine, PharmacyBasket } from "../contracts";

// Mock prices only. Real prices always come from the pharmacy pages (plan §2A).
const line = (medicine: string, strength: string, product_name: string, pack_size: string, unit_price: number | null, url: string | null, in_stock: boolean | null = true, price_verified = true): BasketLine => ({
  medicine, strength, quantity: 1, product_name, pack_size, unit_price, line_total: price_verified ? unit_price : null, in_stock, product_url: url, price_verified,
});

// Opaque in real responses (an encrypted token); any non-empty string works with mocks.
const MOCK_JOB_ID = "mock-basket-job";

export const basketCompareMock: BasketCompareRes = {
  job_id: MOCK_JOB_ID,
  status: "done",
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
      source: "netmeds", status: "partial", total: 32, missing: ["Telma 40 mg"], checkout_url: "https://www.netmeds.com",
      lines: [
        line("Metformin", "500 mg", "Glycomet 500mg SR Strip Of 20 Tablets", "strip of 20 tablets", 32, "https://www.netmeds.com/products?q=metformin%20500"),
        { medicine: "Telma", strength: "40 mg", quantity: 1, product_name: null, pack_size: null, unit_price: null, line_total: null, in_stock: null, product_url: null, price_verified: false },
        // The page showed a different price than the agent read, so it is shown as unconfirmed and not counted.
        line("Dolo", "650 mg", "Dolo 650mg Strip Of 15 Tablets", "strip of 15 tablets", 31.2, "https://www.netmeds.com/products?q=dolo%20650", true, false),
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

const pending = (source: PharmacyBasket["source"]): PharmacyBasket => ({ source, status: "pending", lines: [], total: null, missing: [], checkout_url: null });

/** What POST returns while agents are still working: two pharmacies done, two pending. Poll the job until "done". */
export const basketJobRunningMock: BasketCompareRes = {
  ...basketCompareMock,
  status: "running",
  baskets: [basketCompareMock.baskets[0], basketCompareMock.baskets[1], pending("netmeds"), pending("apollo")],
  savings_vs_highest: 14.2,
};

const dolo = (source: PharmacyBasket["source"], price: number, url: string, home: string): PharmacyBasket => ({
  source, status: "ok", total: price, missing: [], checkout_url: home,
  lines: [line("Dolo", "650 mg", "Dolo 650 Tablet", "strip of 15 tablets", price, url)],
});

/** A single-medicine check (a one-item basket) while two pharmacies are still working. */
export const singleMedicineJobMock: BasketCompareRes = {
  job_id: MOCK_JOB_ID,
  status: "running",
  baskets: [
    dolo("pharmeasy", 28.9, "https://pharmeasy.in/online-medicine-order/dolo-650", "https://pharmeasy.in"),
    dolo("1mg", 30.5, "https://www.1mg.com/drugs/dolo-650-tablet", "https://www.1mg.com"),
    pending("netmeds"),
    pending("apollo"),
  ],
  cheapest_source: "pharmeasy",
  generic: null,
  savings_vs_highest: 1.6,
  cached: false,
};
