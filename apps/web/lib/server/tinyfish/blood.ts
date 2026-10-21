import "server-only";
import { z } from "zod";
import { BloodSearchReq, type BloodBank, type BloodComponent, type BloodGroup, type BloodSearchRes, type BloodSearchSource } from "@vyana/shared";
import { TTL, cached, normalizeKeyPart } from "../cache";
import { notFound } from "../errors";
import { openJob, sealJob } from "../jobs";
import { AGENT_MAX_SECONDS, QUEUE_DEADLINE_MS, RUN_DEADLINE_MS } from "./basket";
import { type CallCounter, type OutputSchema, cancelRun, getRun, startAgent } from "./client";
import { BLOOD_SOURCE, bloodAreas } from "./sources";

/**
 * RapidBlood (v1.1.0): a background job like the basket and the labs. One agent per area reads the public stock page of
 * e-RaktKosh. The result form can't be fetched again (it is a posted form), so a row is `verified` when the row text the
 * agent copied from the page contains the bank's name and its unit count. Nothing is estimated; the UI always says
 * "call to confirm".
 */

const COMPONENT_LABEL: Record<BloodComponent, string> = {
  whole_blood: "Whole Blood",
  red_cells: "Packed Red Blood Cells",
  platelets: "Platelets",
  plasma: "Fresh Frozen Plasma",
};
const MAX_UNITS = 1000; // a bank listing more is a misread
const MAX_BANKS_PER_AREA = 10;

export const bloodQuery = (r: BloodSearchReq) => `${r.blood_group.toLowerCase()} · ${r.component} · ${normalizeKeyPart(r.city)}`;

export function bloodGoal(group: BloodGroup, component: BloodComponent, area: string): string {
  return [
    "Open this public blood stock availability search.",
    `Choose blood group "${group}", component "${COMPONENT_LABEL[component]}" and the state and district of "${area}", then search.`,
    "Do NOT log in or book anything. If a CAPTCHA or login appears, stop and return found=false.",
    "Return up to 8 blood banks exactly as listed: name, address, phone, units (a number), component, the page's own updated text, and row_text (the whole row copied as shown).",
    "Never estimate; return found=false if no bank is listed.",
  ].join(" ");
}

const nullableString = { type: "string", nullable: true } as const;
export const BLOOD_OUTPUT_SCHEMA: OutputSchema = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    banks: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, address: nullableString, phone: nullableString, units: { type: "number", nullable: true }, component: nullableString, updated: nullableString, row_text: nullableString },
        required: ["name"],
      },
    },
  },
  required: ["found"],
};

const Row = z.object({
  name: z.string(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  units: z.number().nullish(),
  component: z.string().nullish(),
  updated: z.string().nullish(),
  row_text: z.string().nullish(),
});
const AgentResult = z.object({ found: z.boolean(), banks: z.array(Row).optional() });

type AreaStatus = BloodSearchSource["status"];
type AreaOutcome = { status: Exclude<AreaStatus, "pending">; banks: BloodBank[] };

/** The bank's name and its unit count both stand in the copied row text. */
function rowConfirms(name: string, units: number | null, rowText: string | null | undefined): boolean {
  if (units === null || !rowText) return false;
  return rowText.toLowerCase().includes(name.toLowerCase()) && rowText.split(/\D+/).includes(String(units));
}

/** One area's agent result → checked rows: a believable unit count, a verified flag, no duplicates. */
export function processBloodResult(area: string, raw: unknown, fetchedAt = new Date().toISOString()): AreaOutcome {
  const parsed = AgentResult.safeParse(raw);
  if (!parsed.success) return { status: "error", banks: [] };
  const seen = new Set<string>();
  const banks: BloodBank[] = [];
  for (const r of parsed.data.banks ?? []) {
    const name = r.name.trim();
    const phone = r.phone?.trim() || null;
    const key = `${name.toLowerCase()}|${phone ?? ""}`;
    if (!parsed.data.found || !name || seen.has(key) || banks.length >= MAX_BANKS_PER_AREA) continue;
    seen.add(key);
    const units = typeof r.units === "number" && Number.isInteger(r.units) && r.units >= 0 && r.units <= MAX_UNITS ? r.units : null;
    banks.push({
      name,
      address: r.address?.trim() || null,
      city: area,
      phone,
      units,
      component: r.component?.trim() || "Not stated",
      source_url: BLOOD_SOURCE.startUrl,
      fetched_at: fetchedAt,
      last_updated_text: r.updated?.trim() || null,
      verified: rowConfirms(name, units, r.row_text),
    });
  }
  return { status: banks.length ? "ok" : "not_found", banks };
}

/** Verified rows first, then more units first, then rows without a count. */
export function summarizeBlood(outcomes: { area: string; status: AreaStatus; banks: BloodBank[] }[]) {
  const banks = outcomes
    .flatMap((o) => o.banks)
    .sort((a, b) => Number(b.verified) - Number(a.verified) || (b.units ?? -1) - (a.units ?? -1));
  return {
    banks,
    sources: outcomes.map((o) => ({ area: o.area, status: o.status })),
    status: outcomes.some((o) => o.status === "pending") ? ("running" as const) : ("done" as const),
  };
}

// ---------------------------------------------------------------- job

const JobRun = z.object({ area: z.string(), run_id: z.string().nullable() });
const BloodJob = z.object({
  v: z.literal(1),
  kind: z.literal("blood"),
  uid: z.string(),
  blood_group: z.string(),
  component: z.string(),
  city: z.string(),
  runs: z.array(JobRun),
  started_at: z.number(),
});
type BloodJob = z.infer<typeof BloodJob>;
type Stored = Omit<BloodSearchRes, "job_id" | "cached">;

const cacheKey = (r: BloodSearchReq) => `blood:${bloodQuery(r)}`;
const jobRequest = (j: BloodJob) => BloodSearchReq.parse({ blood_group: j.blood_group, component: j.component, city: j.city });

function mockResult(area: string) {
  const row = (n: string, units: number) => ({ name: `[mock] Blood Bank ${n} ${area}`, address: `${area} (fictional)`, phone: "+91 90000 00020", units, component: "Whole Blood", updated: "mock", row_text: `[mock] Blood Bank ${n} ${area} ${units} Whole Blood` });
  return { found: true, banks: [row("A", 4), row("B", 0)] };
}

/** POST: a finished search from the 15 minute cache, or one agent per area. */
export async function startBloodJob(uid: string, reqIn: BloodSearchReq, counter: CallCounter): Promise<BloodSearchRes> {
  const req = { ...reqIn, city: reqIn.city.trim().replace(/\s+/g, " ") };
  const hit = await cached<Stored>(cacheKey(req), "blood", TTL.quarter, async () => null);
  const base = { v: 1, kind: "blood", uid, blood_group: req.blood_group, component: req.component, city: req.city, started_at: Date.now() } as const;
  if (hit) return { ...hit.value, job_id: sealJob({ ...base, runs: [] } satisfies BloodJob), cached: true };

  const runs = await Promise.all(
    bloodAreas(req.city).map(async (area) => {
      const out = await startAgent(
        {
          url: BLOOD_SOURCE.startUrl,
          goal: bloodGoal(req.blood_group, req.component, area),
          output_schema: BLOOD_OUTPUT_SCHEMA,
          browser_profile: "stealth",
          maxSeconds: AGENT_MAX_SECONDS,
          mockResult: process.env.TINYFISH_MOCK === "1" ? mockResult(area) : undefined,
        },
        { counter },
      );
      return { area, run_id: out.status === "started" ? out.runId : null };
    }),
  );

  const outcomes = runs.map((r) => ({ area: r.area, status: (r.run_id ? "pending" : "error") as AreaStatus, banks: [] }));
  return { job_id: sealJob({ ...base, runs } satisfies BloodJob), query: bloodQuery(req), area: req.city, ...summarizeBlood(outcomes), cached: false };
}

async function outcomeForRun(run: z.infer<typeof JobRun>, job: BloodJob, counter: CallCounter): Promise<{ area: string; status: AreaStatus; banks: BloodBank[] }> {
  if (!run.run_id) return { area: run.area, status: "error", banks: [] };
  const runId = run.run_id;
  let state: AreaStatus = "pending";
  const done = await cached<AreaOutcome>(`bloodrun:${runId}`, "blood_run", TTL.quarter, async () => {
    const r = await getRun(runId, { counter });
    if (r.status === "COMPLETED") return processBloodResult(run.area, r.result);
    if (r.status === "FAILED" || r.status === "CANCELLED") {
      state = r.error === "TIMEOUT" || r.error === "MAX_STEPS_EXCEEDED" || r.status === "CANCELLED" ? "timeout" : "error";
      return null;
    }
    const now = Date.now();
    if ((r.status === "RUNNING" && r.startedAt !== null && now - r.startedAt > RUN_DEADLINE_MS) || now - job.started_at > QUEUE_DEADLINE_MS) {
      await cancelRun(runId, { counter });
      state = "timeout";
    }
    return null;
  });
  return done ? { area: run.area, ...done.value } : { area: run.area, status: state, banks: [] };
}

/** GET: the job's progress; a finished area is processed once and cached. */
export async function pollBloodJob(uid: string, jobId: string, counter: CallCounter): Promise<BloodSearchRes> {
  const parsed = BloodJob.safeParse(openJob(jobId));
  if (!parsed.success || parsed.data.uid !== uid) throw notFound("This blood search was not found. Start a new one.");
  const job = parsed.data;
  const req = jobRequest(job);

  if (job.runs.length === 0) {
    const hit = await cached<Stored>(cacheKey(req), "blood", TTL.quarter, async () => null);
    if (!hit) throw notFound("This blood search has expired. Start a new one.");
    return { ...hit.value, job_id: jobId, cached: true };
  }

  const outcomes = await Promise.all(job.runs.map((r) => outcomeForRun(r, job, counter)));
  const result: Stored = { query: bloodQuery(req), area: job.city, ...summarizeBlood(outcomes) };
  if (result.status === "done" && result.banks.length) await cached<Stored>(cacheKey(req), "blood", TTL.quarter, async () => result);
  return { ...result, job_id: jobId, cached: false };
}
