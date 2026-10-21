import { describe, expect, it } from "vitest";
import { parseRow, unitsFromCell, type Area } from "@/lib/server/web/eraktkosh";

const area: Area = { label: "Delhi", stateCode: "97", districtCode: "-1", mustContain: null };
const at = "2026-10-21T10:00:00.000Z";
const row = (info: string, stock: string, updated = "2026-10-21 15:46:50") => ["1", info, "Govt.", stock, updated, "Blood Bank"];

describe("unitsFromCell", () => {
  it("reads the number after the group, only for a cell that says Available", () => {
    expect(unitsFromCell("<p class='text-success'>Available, B-Ve:16</p>")).toBe(16);
    expect(unitsFromCell("Available, A+Ve:2, O+Ve:3, B-Ve:1")).toBeNull(); // several groups: not ours to pick
    expect(unitsFromCell("<p>Packed Red Blood Cells Not Available Search for another Component")).toBeNull();
    expect(unitsFromCell("Available, B-Ve:0")).toBeNull();
    expect(unitsFromCell("Available, B-Ve:100000")).toBeNull(); // a misread
    expect(unitsFromCell("Available")).toBeNull();
  });
});

describe("parseRow", () => {
  it("takes name, address, phone, units and the source's own updated text", () => {
    const bank = parseRow(row("Test Blood Centre<br/>1 Road, Delhi<br/>Phone: 9000000001 ,Fax: -, Email: a@b.test", "Available, B-Ve:5"), area, "Whole Blood", at);
    expect(bank).toEqual({
      name: "Test Blood Centre",
      address: "1 Road, Delhi",
      city: "Delhi",
      phone: "9000000001",
      units: 5,
      component: "Whole Blood",
      source_url: "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt",
      fetched_at: at,
      last_updated_text: "2026-10-21 15:46:50",
      verified: true,
    });
  });

  it("uses the first part of the address when the name is a dash, and drops a row without any name", () => {
    expect(parseRow(row("-<br/>Dummy Institute, 3 Lane, Delhi<br/>-", "Available, B-Ve:2"), area, "c", at)?.name).toBe("Dummy Institute");
    expect(parseRow(row("-<br/>-<br/>-", "Available, B-Ve:2"), area, "c", at)).toBeNull();
  });

  it("never lets markup through, and decodes the entities of the source", () => {
    const bank = parseRow(row("A &amp; B <script>alert(1)</script>Bank<br/><b>1 Road</b><br/>Phone: 9000000006", "Available, B-Ve:7"), area, "c", at);
    expect(bank?.name).toBe("A & B alert(1)Bank");
    expect(bank?.address).toBe("1 Road");
    expect(bank?.phone).toBe("9000000006");
  });

  it("returns null for rows that are not a table row or hold no stock", () => {
    expect(parseRow("nope", area, "c", at)).toBeNull();
    expect(parseRow(["1", "x"], area, "c", at)).toBeNull();
    expect(parseRow(row("Bank<br/>Road", "Not Available"), area, "c", at)).toBeNull();
  });

  it("keeps only rows that mention the city when the district could not be matched", () => {
    const strict: Area = { ...area, mustContain: "pune" };
    expect(parseRow(row("Pune Blood Bank<br/>Road, Pune<br/>Phone: 9000000007", "Available, B-Ve:3"), strict, "c", at)).not.toBeNull();
    expect(parseRow(row("Other Bank<br/>Road, Nagpur<br/>Phone: 9000000008", "Available, B-Ve:3"), strict, "c", at)).toBeNull();
  });
});
