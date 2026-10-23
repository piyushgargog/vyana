/**
 * Evidence check (PLAN §2A rule 1, DESIGN §10): a value the model extracted is kept only when the exact
 * source text it cites appears in the document. Pure functions, no I/O.
 */
import { z } from "zod";

/**
 * The LLM output shape of one extracted field (§2A rule 1): the value the model read, wrapped with the exact
 * source text it quotes as evidence. `verifyEvidence` / `evidenceFound` below check that evidence afterwards.
 */
export const field = <T extends z.ZodTypeAny>(value: T) => z.object({ value: value.nullable(), evidence: z.string().nullable() });

const DASHES = /[‐-―−﹘﹣－]/g;
const QUOTES_SINGLE = /[‘’‚‛′]/g;
const QUOTES_DOUBLE = /[“”„‟″]/g;

/** Case, whitespace, unicode dash/quote and width differences don't count as a mismatch. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(DASHES, "-")
    .replace(QUOTES_SINGLE, "'")
    .replace(QUOTES_DOUBLE, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `evidence` is a non-empty passage found verbatim (after normalizing) in `docText`. */
export function evidenceFound(docText: string, evidence: string | null | undefined): boolean {
  if (!evidence) return false;
  const needle = normalizeText(evidence);
  return needle.length > 0 && normalizeText(docText).includes(needle);
}

export interface EvidenceField<V> {
  value: V | null;
  evidence: string | null | undefined;
}

/**
 * Checks every field against the document. A field whose evidence is missing or not found loses its value,
 * and the row is marked `needs_review` so a human confirms it.
 */
export function verifyEvidence<F extends Record<string, unknown>>(
  docText: string,
  fields: { [K in keyof F]: EvidenceField<F[K]> },
): { values: { [K in keyof F]: F[K] | null }; failed: (keyof F)[]; needs_review: boolean } {
  const doc = normalizeText(docText);
  const values = {} as { [K in keyof F]: F[K] | null };
  const failed: (keyof F)[] = [];
  for (const key of Object.keys(fields) as (keyof F)[]) {
    const { value, evidence } = fields[key];
    if (value === null) {
      values[key] = null;
      continue;
    }
    const needle = evidence ? normalizeText(evidence) : "";
    if (needle && doc.includes(needle)) {
      values[key] = value;
    } else {
      values[key] = null;
      failed.push(key);
    }
  }
  return { values, failed, needs_review: failed.length > 0 };
}

/**
 * Every number written in `s` ("1,50,000" → 150000, "4.0" → 4). A plain scan, so long text stays cheap.
 * Strict by default: every digit run counts, so "2x500" yields 2 and 500. With `skipGlued` digits glued to a letter
 * ("HbA1c", "T3", "B12") are treated as part of a name, not a written number (lab-report evidence only; never use it
 * for doses, where "Paracetamol500mg" must still yield 500).
 */
export function numbersIn(s: string, opts: { skipGlued?: boolean } = {}): number[] {
  const out: number[] = [];
  let current = "";
  let glued = false; // the number started right after a letter
  const flush = () => {
    const cleaned = current.replace(/,/g, "").replace(/\.$/, "");
    if (/\d/.test(cleaned) && !(opts.skipGlued && glued)) out.push(Number(cleaned));
    current = "";
    glued = false;
  };
  let prev = "";
  for (const ch of s) {
    if ((ch >= "0" && ch <= "9") || ((ch === "." || ch === ",") && current.length > 0)) {
      if (current.length === 0) glued = /\p{L}/u.test(prev);
      current += ch;
    } else flush();
    prev = ch;
  }
  flush();
  return out.filter((n) => Number.isFinite(n));
}

/** True when `n` is one of the numbers written in `s` (compared as numbers, so 3 doesn't match "30"). */
export function hasNumber(s: string | null | undefined, n: number, opts: { skipGlued?: boolean } = {}): boolean {
  return !!s && numbersIn(s, opts).some((x) => Math.abs(x - n) < 1e-9);
}
