import { describe, expect, it } from "vitest";

import { buildBloodRequestMessage } from "./index";

const request = {
  blood_group: "B-",
  component: "red_cells",
  units: 2,
  hospital_name: "Fortis Hospital",
  city: "Noida",
  contact_name: "Rukhsana Khan",
  contact_phone: "+91 00000 00002",
};

describe("buildBloodRequestMessage", () => {
  it("is plain readable text, one fact per line", () => {
    expect(buildBloodRequestMessage(request)).toBe(
      ["Blood needed", "Group: B-", "Component: red cells, 2 units", "Hospital: Fortis Hospital, Noida", "Contact: Rukhsana Khan +91 00000 00002"].join("\n"),
    );
  });

  it("leaves the unit count out entirely when none was entered", () => {
    const { units: _units, ...withoutUnits } = request;
    const text = buildBloodRequestMessage(withoutUnits);
    expect(text).toContain("Component: red cells\n");
    expect(text).not.toMatch(/\d+ units?\b/);
  });

  it("says 1 unit, not 1 units", () => {
    expect(buildBloodRequestMessage({ ...request, units: 1 })).toContain("Component: red cells, 1 unit\n");
  });

  it("writes every component of the contracts in plain words", () => {
    expect(buildBloodRequestMessage({ ...request, component: "whole_blood" })).toContain("Component: whole blood,");
    expect(buildBloodRequestMessage({ ...request, component: "platelets" })).toContain("Component: platelets,");
    expect(buildBloodRequestMessage({ ...request, component: "plasma" })).toContain("Component: plasma,");
  });

  it("makes no claim about stock, matching or how fast blood can be there", () => {
    const text = buildBloodRequestMessage(request).toLowerCase();
    for (const claim of ["available", "in stock", "guaranteed", "will reach", "matched", "safe"]) expect(text).not.toContain(claim);
  });

  it("tidies the spaces of what the patient typed", () => {
    const messy = buildBloodRequestMessage({ ...request, hospital_name: "  Fortis   Hospital ", contact_phone: "+91  00000   00002" });
    expect(messy).toContain("Hospital: Fortis Hospital, Noida");
    expect(messy).toContain("Contact: Rukhsana Khan +91 00000 00002");
  });
});
