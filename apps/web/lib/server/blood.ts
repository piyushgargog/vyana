import "server-only";
import { z } from "zod";
import { BloodSearchReq, type BloodBank, type BloodSearchRes, type BloodSearchSource } from "@vyana/shared";
import { normalizeKeyPart } from "./cache";
import { notFound } from "./errors";
import { openJob, sealJob } from "./jobs";
import { type Area, type AreaResult, resolveAreas, searchArea } from "./web/eraktkosh";

/**
 * RapidBlood (ADR-072): the stock of blood banks as e-RaktKosh lists it, read directly (about a second). A row is what the
 * public page listed at `fetched_at`; the UI says "listed" and "call to confirm". Nothing is estimated or promised, and
 * the app never moves blood: the patient calls, and sets every request status themselves (ADR-071).
 * The API keeps the shape of the old background job (`job_id`, `status`) so the screens did not have to change; the job
 * is always `done` and the id only carries the request, so the poll route can answer from the cache.
 */

// Cities next to a big city, searched as well (an attendant will travel). Only pairs that are certainly adjacent.
const NEARBY_CITIES: Record<string, string[]> = {
  delhi: ["Gurugram", "Noida", "Ghaziabad"],
  "new delhi": ["Gurugram", "Noida", "Ghaziabad"],
  mumbai: ["Thane"],
  kolkata: ["Howrah"],
  pune: [],
  hyderabad: ["Rangareddy"],
};
const MAX_AREAS = 4;

const bloodQuery = (r: BloodSearchReq) => `${r.blood_group.toLowerCase()} · ${r.component} · ${normalizeKeyPart(r.city)}`;

/** The searched city first, then nearby cities; a name that matches no district of the source is dropped. */
export async function bloodAreas(city: string): Promise<Area[]> {
  const names = [city, ...(NEARBY_CITIES[normalizeKeyPart(city)] ?? [])];
  const resolved = await Promise.all(names.map((n) => resolveAreas(n)));
  const seen = new Set<string>();
  const areas: Area[] = [];
  for (const a of resolved.flat()) {
    const k = `${a.stateCode}:${a.districtCode}`;
    if (!seen.has(k)) {
      seen.add(k);
      areas.push(a);
    }
  }
  return areas.slice(0, MAX_AREAS);
}

/** Most units first (every row is read from the response itself, so all are verified). */
function summarizeBlood(results: AreaResult[]): { banks: BloodBank[]; sources: BloodSearchSource[]; status: "done" } {
  const seen = new Set<string>();
  const banks = results
    .flatMap((r) => r.banks)
    .filter((b) => {
      const k = `${b.name.toLowerCase()}|${b.phone ?? ""}|${b.component}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (b.units ?? -1) - (a.units ?? -1));
  return { banks, sources: results.map((r) => ({ area: r.area, status: r.status })), status: "done" };
}

const BloodJob = z.object({
  v: z.literal(2),
  kind: z.literal("blood"),
  uid: z.string(),
  blood_group: z.string(),
  component: z.string(),
  city: z.string(),
});
type BloodJob = z.infer<typeof BloodJob>;

async function run(req: BloodSearchReq): Promise<Omit<BloodSearchRes, "job_id" | "cached">> {
  let areas: Area[] = [];
  try {
    areas = await bloodAreas(req.city);
  } catch {
    // the source's state and district lists did not answer: say so, do not fail the request
    return { query: bloodQuery(req), area: req.city, ...summarizeBlood([{ area: req.city, status: "error", banks: [] }]) };
  }
  const results = areas.length
    ? await Promise.all(areas.map((a) => searchArea(a, req.blood_group, req.component)))
    : [{ area: req.city, status: "not_found" as const, banks: [] }]; // the city matches no district of the source
  return { query: bloodQuery(req), area: req.city, ...summarizeBlood(results) };
}

/** POST: the search runs now; the id lets the poll route repeat it from the cache. */
export async function startBloodJob(uid: string, reqIn: BloodSearchReq): Promise<BloodSearchRes> {
  const req = { ...reqIn, city: reqIn.city.trim().replace(/\s+/g, " ") };
  const job: BloodJob = { v: 2, kind: "blood", uid, blood_group: req.blood_group, component: req.component, city: req.city };
  return { ...(await run(req)), job_id: sealJob(job), cached: false };
}

/** GET: the same search again (served from the 15 minute cache); a token from another person or an old version is not found. */
export async function pollBloodJob(uid: string, jobId: string): Promise<BloodSearchRes> {
  const parsed = BloodJob.safeParse(openJob(jobId));
  if (!parsed.success || parsed.data.uid !== uid) throw notFound("This blood search was not found. Start a new one.");
  const req = BloodSearchReq.parse({ blood_group: parsed.data.blood_group, component: parsed.data.component, city: parsed.data.city });
  return { ...(await run(req)), job_id: jobId, cached: true };
}
