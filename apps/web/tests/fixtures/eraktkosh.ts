// A small copy of the shape e-RaktKosh answers (probed 21 Oct 2026), with fictional banks and phone numbers.
// Each stock row: [no, "name<br/>address<br/>Phone: .., Fax: .., Email: ..", category, stock cell, updated, type].

export const STATES = [
  { value: "97", label: "Delhi" },
  { value: "96", label: "Haryana" },
  { value: "99", label: "Uttar Pradesh" },
  { value: "27", label: "Maharashtra" },
];

export const DISTRICTS: Record<string, { id: string; value: string }[]> = {
  "97": [{ id: "Central", value: "95" }, { id: "New Delhi", value: "94" }],
  "96": [{ id: "Gurgaon", value: "10" }, { id: "Faridabad", value: "11" }],
  "99": [{ id: "Gautam Buddha Nagar", value: "20" }, { id: "Ghaziabad", value: "21" }],
  "27": [{ id: "Mumbai", value: "30" }, { id: "Pune", value: "31" }, { id: "Thane", value: "32" }],
};

const row = (n: number, info: string, stock: string, updated = "2026-10-21 15:46:50") => [String(n), info, "Govt.", stock, updated, "Blood Bank"];

export const STOCK_ROWS = [
  row(1, "Test Hospital Blood Centre<br/>1 Test Road, Central, Delhi<br/>Phone: 9000000001 ,Fax: -, Email: a@example.test", "<p class='text-success'>Available, B-Ve:5</p>"),
  row(2, "Fictional Medical College<br/>2 Sample Marg, New Delhi, Delhi<br/>Phone: 011-2000002 ,Fax: -, Email: -", "<p class='text-success'>Available, B-Ve:16</p>", ""),
  row(3, "-<br/>Dummy Institute, 3 Lane, Delhi<br/>-", "<p class='text-success'>Available, B-Ve:2</p>"),
  row(4, "Empty Shelf Blood Bank<br/>4 Nowhere Road, Delhi<br/>Phone: 9000000004", "<p class='text-danger'><b>Packed Red Blood Cells</b>Not Available Search for another Component"),
  row(5, "Huge Number Blood Bank<br/>5 Road, Delhi<br/>Phone: 9000000005", "<p class='text-success'>Available, B-Ve:99999</p>"),
  row(6, "A &amp; B Blood Bank<br/>6 Road, Delhi<br/>Phone: 9000000006", "<p class='text-success'>Available, B-Ve:7</p>"),
];

export const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/** A fake of the three calls; counts them so a test can see the cache working. */
export function fakeERaktKosh(rows: unknown[] = STOCK_ROWS) {
  const calls: string[] = [];
  const fetchFn = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const q = new URL(url).searchParams;
    switch (q.get("hmode")) {
      case "GETSTATELIST":
        return json(STATES);
      case "GETDISTRICTLIST":
        return json({ records: DISTRICTS[q.get("selectedStateCode") ?? ""] ?? [] });
      case "GETNEARBYSTOCKDETAILS":
        return json({ data: rows });
      default:
        return new Response("not found", { status: 404 });
    }
  };
  return { fetchFn, calls };
}
