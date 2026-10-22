import { describe, expect, it } from "vitest";

import { filterHospitalsByQuery } from "./hospital-search";

const hospitals = [
  { id: "1", name: "City Care Hospital", city: "Noida" },
  { id: "2", name: "Fortis Hospital", city: "Gurugram" },
  { id: "3", name: "Noida Children's Clinic", city: "Delhi" },
];

describe("filterHospitalsByQuery", () => {
  it("an empty query returns every hospital", () => {
    expect(filterHospitalsByQuery(hospitals, "")).toHaveLength(3);
  });

  it("a whitespace-only query returns every hospital", () => {
    expect(filterHospitalsByQuery(hospitals, "   ")).toHaveLength(3);
  });

  it("matches on the name, ignoring case and surrounding spaces", () => {
    expect(filterHospitalsByQuery(hospitals, "  fortis ")).toEqual([hospitals[1]]);
  });

  it("matches on the city", () => {
    expect(filterHospitalsByQuery(hospitals, "gurugram")).toEqual([hospitals[1]]);
  });

  it("a name match and a city match can both appear", () => {
    expect(filterHospitalsByQuery(hospitals, "noida")).toEqual([hospitals[0], hospitals[2]]);
  });

  it("no match returns an empty list", () => {
    expect(filterHospitalsByQuery(hospitals, "jaipur")).toEqual([]);
  });
});
