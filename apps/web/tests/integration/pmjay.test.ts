import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PmjayHospitalsRes } from "@vyana/shared";
import { VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { POST } = await import("@/app/api/schemes/pmjay-hospitals/route");
const { isGovUrl, verifyPmjay } = await import("@/lib/server/tinyfish/hospitals");

const post = (body: unknown, token = VALID_TOKEN) =>
  POST(
    new Request("http://localhost/api/schemes/pmjay-hospitals", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    undefined,
  );

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "1");
  vi.stubEnv("LLM_MOCK", "1");
  resetDb();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isGovUrl", () => {
  it("accepts only government hosts", () => {
    expect(isGovUrl("https://ayushmanbharat.haryana.gov.in/pm-jay/")).toBe(true);
    expect(isGovUrl("https://sha.delhi.nic.in/list")).toBe(true);
    expect(isGovUrl("https://www.bajajfinserv.in/insurance/ayushman-card-hospital-list-in-delhi")).toBe(false);
    expect(isGovUrl("https://gov.in.evil.example/x")).toBe(false);
    expect(isGovUrl("ftp://health.gov.in/x")).toBe(false);
  });
});

describe("verifyPmjay", () => {
  const page = { url: "https://health.example.gov.in/list", title: "List", text: "Apex Hospital, 4 MG Road, Delhi. Specialities: Cardiology." };
  it("keeps only names, addresses and specialities written on a government page", () => {
    const out = verifyPmjay(
      {
        hospitals: [
          { name: "Apex Hospital", address: "4 MG Road, Delhi", specialities: ["Cardiology", "Neurology"], page: 0 },
          { name: "Invented Hospital", address: null, specialities: [], page: 0 },
        ],
      },
      [page],
    );
    expect(out.hospitals).toEqual([{ name: "Apex Hospital", address: "4 MG Road, Delhi", specialities: ["Cardiology"], source_url: page.url }]);
    expect(out.dropped).toBe(2); // the invented hospital and "Neurology"
    expect(verifyPmjay({ hospitals: [{ name: "Apex Hospital", address: null, specialities: [], page: 0 }] }, [{ ...page, url: "https://blog.example.com/list" }]).hospitals).toEqual([]);
  });
});

describe("POST /api/schemes/pmjay-hospitals", () => {
  it("returns hospitals verified on a government page, and caches them for a week", async () => {
    const res = await post({ lat: 28.5672, lng: 77.21 });
    expect(res.status).toBe(200);
    const body = PmjayHospitalsRes.parse(await res.json());
    expect(body.hospitals).toEqual([
      { name: "[mock] Sanjeevani Hospital", address: "[mock] 12 Ring Road, Delhi", specialities: ["General Medicine", "Cardiology"], source_url: "https://health.mock.gov.in/pmjay-hospitals" },
    ]);
    expect(body.cached).toBe(false);
    expect(db.rows.ai_runs[0]).toMatchObject({ feature: "pmjay_hospitals", status: "needs_review" }); // "Oncology" isn't on the page
    const again = PmjayHospitalsRes.parse(await (await post({ lat: 28.5672, lng: 77.21 })).json());
    expect(again.cached).toBe(true);
  });

  it("needs a signed-in user and numbers for the location", async () => {
    expect((await post({ lat: 28.5, lng: 77.2 }, "")).status).toBe(401);
    expect((await post({ lat: "x", lng: 77.2 })).status).toBe(400);
  });
});
