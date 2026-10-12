/**
 * Evidence check (PLAN §2A rule 1, DESIGN §10): a value the model extracted is kept only when the exact
 * source text it cites appears in the document. Pure functions, no I/O.
 */

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
