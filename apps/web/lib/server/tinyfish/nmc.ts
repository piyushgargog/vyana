import "server-only";
import { z } from "zod";
import { councilKey, normalizeRegNo } from "../doctor-register";
import { runAgent, type CallCounter, type OutputSchema } from "./client";
import { NMC_REGISTER_URL } from "./sources";

export { councilKey, normalizeRegNo };

/**
 * Doctor verification on the NMC Indian Medical Register (SPEC §7, PLAN §2A, ADR-047). The agent only reads the
 * register; whether a doctor is verified is decided here, in code.
 */

export const NmcRecord = z.object({
  name: z.string(),
  reg_no: z.string(),
  state_council: z.string(),
  year_of_registration: z.number().int().nullable().optional(),
});
export type NmcRecord = z.infer<typeof NmcRecord>;

export const NmcResult = z.object({
  found: z.boolean(),
  blocked: z.boolean().optional(),
  records: z.array(NmcRecord),
});
export type NmcResult = z.infer<typeof NmcResult>;

export const NMC_OUTPUT_SCHEMA: OutputSchema = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    blocked: { type: "boolean" },
    records: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          reg_no: { type: "string" },
          state_council: { type: "string" },
          year_of_registration: { type: "integer", nullable: true },
        },
        required: ["name", "reg_no", "state_council"],
      },
    },
  },
  required: ["found", "records"],
};

export function nmcGoal(regNo: string, council: string): string {
  return [
    "This is the Indian Medical Register search page of the National Medical Commission.",
    `Search by Registration Number "${regNo}" and State Medical Council "${council}" (choose the closest council in the list).`,
    "Read the results table. For every row return the doctor's name, registration number, state medical council and year of registration exactly as shown.",
    "If there are no rows, return found=false and an empty list.",
    "If a CAPTCHA, a login or any other check appears, stop immediately and return blocked=true. Do not try to get past it.",
    "Do not open other sites or change anything.",
  ].join(" ");
}

// ---------------------------------------------------------------- matching (code decides)

// `normalizeRegNo` and `councilKey` are imported from `../doctor-register` (and
// re-exported above), so the register lookup and the manual admin check can never
// drift into two different notions of the same registration number or council.

const NAME_FILLER = new Set(["dr", "doctor", "mr", "mrs", "ms", "smt", "shri"]);
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\./g, " ")
    .split(/[^a-z]+/)
    .filter((t) => t && !NAME_FILLER.has(t));
}

/** Share of tokens that match (an initial matches a name starting with it), over the longer name. */
export function nameOverlap(a: string, b: string): number {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (!x.length || !y.length) return 0;
  const used = new Set<number>();
  let matched = 0;
  for (const t of x) {
    const j = y.findIndex((u, i) => !used.has(i) && (u === t || (t.length === 1 && u.startsWith(t)) || (u.length === 1 && t.startsWith(u))));
    if (j !== -1) {
      used.add(j);
      matched++;
    }
  }
  return matched / Math.max(x.length, y.length);
}

export const NAME_THRESHOLD = 0.6;

export interface Claim {
  name: string;
  reg_no: string;
  state_council: string;
  year_of_registration?: number;
}

/** True when the register row is this doctor (ADR-047). */
export function recordMatches(record: NmcRecord, claim: Claim): boolean {
  const surname = (n: string) => nameTokens(n).at(-1);
  const yearOk = !claim.year_of_registration || !record.year_of_registration || record.year_of_registration === claim.year_of_registration;
  return (
    normalizeRegNo(record.reg_no) === normalizeRegNo(claim.reg_no) &&
    councilKey(record.state_council) === councilKey(claim.state_council) &&
    surname(record.name) !== undefined &&
    surname(record.name) === surname(claim.name) &&
    nameOverlap(record.name, claim.name) >= NAME_THRESHOLD &&
    yearOk
  );
}

/** The row to show when nothing matches: same number first, then the most similar name. */
export function closestRecord(records: NmcRecord[], claim: Claim): NmcRecord | null {
  if (!records.length) return null;
  return [...records].sort(
    (a, b) =>
      Number(normalizeRegNo(b.reg_no) === normalizeRegNo(claim.reg_no)) - Number(normalizeRegNo(a.reg_no) === normalizeRegNo(claim.reg_no)) ||
      nameOverlap(b.name, claim.name) - nameOverlap(a.name, claim.name),
  )[0];
}

// ---------------------------------------------------------------- agent

/** `TINYFISH_MOCK=1`: a one-row register for the seeded doctor2 (ADR-047). */
function mockRegister(regNo: string, council: string): NmcResult {
  const hit = normalizeRegNo(regNo) === "12345" && councilKey(council) === "delhi";
  return hit
    ? { found: true, records: [{ name: "SNEHA GUPTA", reg_no: "12345", state_council: "Delhi Medical Council", year_of_registration: 2011 }] }
    : { found: false, records: [] };
}

export type RegisterLookup = { status: "ok"; result: NmcResult } | { status: "pending"; reason: string };

export async function lookupRegister(regNo: string, council: string, counter: CallCounter): Promise<RegisterLookup> {
  const out = await runAgent<NmcResult>(
    {
      url: NMC_REGISTER_URL,
      goal: nmcGoal(regNo, council),
      output_schema: NMC_OUTPUT_SCHEMA,
      browser_profile: "stealth",
      parse: (r) => NmcResult.parse(r),
      mockResult: process.env.TINYFISH_MOCK === "1" ? mockRegister(regNo, council) : undefined,
    },
    { counter },
  );
  if (out.status === "ok" && out.result) {
    return out.result.blocked ? { status: "pending", reason: "The register asked for a check we don't automate." } : { status: "ok", result: out.result };
  }
  if (out.status === "not_found") return { status: "ok", result: { found: false, records: [] } };
  return { status: "pending", reason: out.status === "timeout" ? "The register took too long to answer." : "The register couldn't be read right now." };
}
