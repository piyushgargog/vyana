import { describe, expect, it } from "vitest";
import { mapsUrl, phoneOnPage, verifyNearby, verifyOpd } from "@/lib/server/tinyfish/hospitals";

const page = (text: string, url = "https://hospital.example/contact") => ({ url, title: "Contact", text });

describe("phoneOnPage", () => {
  const text = "Emergency: 011-2658 8500 | Ambulance +91 98765 43210 | Fax (011) 2659-1234";
  it("matches the digits whatever the separators", () => {
    expect(phoneOnPage(text, "011 26588500")).toBe(true);
    expect(phoneOnPage(text, "01126588500")).toBe(true);
    expect(phoneOnPage(text, "+91-9876543210")).toBe(true);
    expect(phoneOnPage(text, "9876543210")).toBe(true);
    expect(phoneOnPage(text, "011-2659 1234")).toBe(true);
  });
  it("rejects numbers that aren't on the page, and short or empty ones", () => {
    expect(phoneOnPage(text, "011-2658 8501")).toBe(false);
    expect(phoneOnPage(text, "108")).toBe(false);
    expect(phoneOnPage(text, null)).toBe(false);
  });
});

describe("verifyNearby", () => {
  const pages = [
    page("# Max Hospital Patparganj\n108, A Block, Patparganj, Delhi. Call 011-4300 4300. 24x7 Emergency and ICU."),
    page("# Sunrise Clinic\nOPD only, call 011-1111 2222.", "https://clinic.example"),
  ];

  it("keeps what the page shows and builds the maps link itself", () => {
    const { hospitals, dropped } = verifyNearby(
      { hospitals: [{ name: "Max Hospital Patparganj", address: "108, A Block, Patparganj, Delhi", phone: "011-43004300", has_emergency: true, has_icu: true, page: 0 }] },
      pages,
    );
    expect(dropped).toBe(0);
    expect(hospitals).toEqual([
      {
        name: "Max Hospital Patparganj",
        address: "108, A Block, Patparganj, Delhi",
        phone: "011-43004300",
        has_emergency: true,
        has_icu: true,
        maps_url: "https://www.google.com/maps/search/?api=1&query=Max%20Hospital%20Patparganj%2C%20108%2C%20A%20Block%2C%20Patparganj%2C%20Delhi",
        source_url: "https://hospital.example/contact",
      },
    ]);
  });

  it("drops a hospital whose name isn't on its page, or whose page doesn't exist", () => {
    const { hospitals, dropped } = verifyNearby(
      {
        hospitals: [
          { name: "Invented Super Speciality Hospital", address: null, phone: null, has_emergency: true, has_icu: true, page: 0 },
          { name: "Max Hospital Patparganj", address: null, phone: null, has_emergency: null, has_icu: null, page: 7 },
        ],
      },
      pages,
    );
    expect(hospitals).toEqual([]);
    expect(dropped).toBe(2);
  });

  it("nulls an address, phone or emergency/ICU claim the page doesn't support", () => {
    const [h] = verifyNearby(
      { hospitals: [{ name: "Sunrise Clinic", address: "12 Fake Street", phone: "011-9999 9999", has_emergency: true, has_icu: true, page: 1 }] },
      pages,
    ).hospitals;
    expect(h).toMatchObject({ name: "Sunrise Clinic", address: null, phone: null, has_emergency: null, has_icu: null, source_url: "https://clinic.example" });
    expect(h.maps_url).toBe("https://www.google.com/maps/search/?api=1&query=Sunrise%20Clinic");
  });

  it("removes duplicates and keeps at most 5", () => {
    const many = Array.from({ length: 8 }, (_, i) => `Hospital ${i}`);
    const p = [page(many.join("\n"))];
    // The duplicate comes second, before the 5-cap is reached, so the dedup is what
    // this case exercises — appended last, the loop would stop at 5 before seeing it.
    const out = verifyNearby(
      { hospitals: ["Hospital 0", "hospital 0", ...many.slice(1)].map((name) => ({ name, address: null, phone: null, has_emergency: null, has_icu: null, page: 0 })) },
      p,
    );
    expect(out.hospitals.map((h) => h.name)).toEqual(["Hospital 0", "Hospital 1", "Hospital 2", "Hospital 3", "Hospital 4"]);
    expect(out.dropped).toBe(1);
  });

  it("nulls an emergency or ICU claim the page itself negates", () => {
    const p = [page("# Sunrise Clinic\nSunrise Clinic has no emergency care and no ICU. OPD only, call 011-1111 2222.", "https://clinic.example")];
    const [h] = verifyNearby(
      { hospitals: [{ name: "Sunrise Clinic", address: null, phone: null, has_emergency: true, has_icu: true, page: 0 }] },
      p,
    ).hospitals;
    expect(h.has_emergency).toBeNull();
    expect(h.has_icu).toBeNull();
  });
});

describe("verifyOpd", () => {
  const pages = [page("Medicine OPD: Monday to Saturday, 8:00 AM to 1:00 PM. Registration closes at 12 noon.")];

  it("keeps a row only when its department and timings are on the page", () => {
    const out = verifyOpd(
      {
        rows: [
          { department: "Medicine", days: "Monday to Saturday", timings: "8:00 AM to 1:00 PM", page: 0 },
          { department: "Cardiology", days: "Monday", timings: "9:00 AM to 11:00 AM", page: 0 },
          { department: "Medicine", days: "Sunday", timings: "8:00 AM to 1:00 PM", page: 3 },
        ],
        notes: "Registration closes at 12 noon.",
        notes_page: 0,
      },
      pages,
    );
    expect(out.opd).toEqual([{ department: "Medicine", days: "Monday to Saturday", timings: "8:00 AM to 1:00 PM" }]);
    expect(out.dropped).toBe(2);
    expect(out.notes).toBe("Registration closes at 12 noon.");
    expect(out.sourceUrl).toBe("https://hospital.example/contact");
  });

  it("drops a row whose days are not on the page, even when its timings are", () => {
    const out = verifyOpd(
      {
        rows: [{ department: "Medicine", days: "Tuesday to Friday", timings: "8:00 AM to 1:00 PM", page: 0 }],
        notes: null,
        notes_page: null,
      },
      pages,
    );
    expect(out.opd).toEqual([]);
    expect(out.dropped).toBe(1);
  });

  it("drops notes that aren't quoted from a page", () => {
    expect(verifyOpd({ rows: [], notes: "Bring two photos.", notes_page: 0 }, pages).notes).toBeNull();
    expect(verifyOpd({ rows: [], notes: "Registration closes at 12 noon.", notes_page: null }, pages).notes).toBeNull();
  });
});

describe("mapsUrl", () => {
  it("encodes the name and address into a maps search", () => {
    expect(mapsUrl("AIIMS & Trauma Centre", null)).toBe("https://www.google.com/maps/search/?api=1&query=AIIMS%20%26%20Trauma%20Centre");
  });
});
