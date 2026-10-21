import type { BloodBank, BloodSearchRes } from "../contracts";

// Fictional blood banks: every name starts with "[mock]" so a mock row can never pass for a real one.
const fetched_at = "2026-10-21T09:30:00.000Z";
const q = "b- · red_cells · delhi";

const bank = (p: Pick<BloodBank, "name" | "address" | "phone" | "units" | "verified" | "last_updated_text">): BloodBank => ({
  city: "Delhi",
  component: "Red Blood Cells",
  source_url: "https://eraktkosh.example/mock-stock",
  fetched_at,
  ...p,
});

const verified = bank({ name: "[mock] Sample Blood Bank A", address: "Sector 1, Delhi", phone: "+91 90000 00010", units: 4, verified: true, last_updated_text: "Updated 21-10-2026 09:10" });
const listedOnly = bank({ name: "[mock] Sample Blood Bank B", address: null, phone: "+91 90000 00011", units: null, verified: false, last_updated_text: null });

/** A finished blood bank search (mock): verified rows first, then rows that are only listed ("call to confirm"). */
export const bloodSearchMock: BloodSearchRes = {
  job_id: "mock-blood-job-done",
  query: q,
  area: "Delhi",
  banks: [verified, listedOnly],
  sources: [
    { area: "Delhi", status: "ok" },
    { area: "Noida", status: "not_found" },
  ],
  status: "done",
  cached: false,
};

/** What `blood.search` returns while the agents run: poll `blood.job(job_id)` until `status` is "done". */
export const bloodJobRunningMock: BloodSearchRes = {
  job_id: "mock-blood-job-done",
  query: q,
  area: "Delhi",
  banks: [],
  sources: [
    { area: "Delhi", status: "pending" },
    { area: "Noida", status: "pending" },
  ],
  status: "running",
  cached: false,
};
