import { describe, expect, it } from "vitest";

import { sortBloodBanks } from "./blood-banks";
import type { BloodBank } from "../contracts";

const bank = (name: string, units: number | null, fetched_at: string): BloodBank => ({
  name,
  address: null,
  city: "Delhi",
  phone: null,
  units,
  component: "red_cells",
  source_url: "https://example.org/stock",
  fetched_at,
  last_updated_text: null,
  verified: true,
});

describe("sortBloodBanks", () => {
  it("puts the bank listing the most units first", () => {
    const sorted = sortBloodBanks([
      bank("Few", 2, "2026-10-21T10:00:00.000Z"),
      bank("Many", 9, "2026-10-21T09:00:00.000Z"),
      bank("Some", 5, "2026-10-21T11:00:00.000Z"),
    ]);
    expect(sorted.map((b) => b.name)).toEqual(["Many", "Some", "Few"]);
  });

  it("breaks a units tie by the freshest read, and puts a bank with no count last", () => {
    const sorted = sortBloodBanks([
      bank("NoCount", null, "2026-10-21T12:00:00.000Z"),
      bank("Older", 4, "2026-10-21T09:00:00.000Z"),
      bank("Fresher", 4, "2026-10-21T11:00:00.000Z"),
    ]);
    expect(sorted.map((b) => b.name)).toEqual(["Fresher", "Older", "NoCount"]);
  });

  it("does not change the input array", () => {
    const input = [bank("B", 1, "2026-10-21T09:00:00.000Z"), bank("A", 3, "2026-10-21T09:00:00.000Z")];
    sortBloodBanks(input);
    expect(input.map((b) => b.name)).toEqual(["B", "A"]);
  });
});
