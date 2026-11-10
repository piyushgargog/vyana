// packages/shared/src/text/clean.ts
// One-line text cleaner for user-typed text (medical ID, blood requests, search
// links): whitespace collapses to single spaces, the ends are trimmed, and the
// result is capped at `max` characters. Kept here so the rule is tested once,
// not re-typed per screen.

/** Collapses whitespace to single spaces, trims, and caps at `max` characters. */
export const cleanInlineText = (text: string | null | undefined, max: number): string =>
  (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * One name normalizer for the whole repo: NFKC, lowercase, then whitespace handling. Names compare
 * equal ignoring case, compatibility characters (full-width forms, ligatures) and spacing, so the same
 * department or dose matches wherever it is checked. `spaces: "strip"` removes all whitespace
 * (department and dose matching, where "New Delhi" and "newdelhi" are the same name); `"collapse"`
 * keeps single spaces (cache keys and salt lookups, where "new delhi" must stay distinct from
 * "newdelhi"). Callers that used to hand-roll this chain must use this instead.
 */
export function normalizeName(s: string, spaces: "strip" | "collapse" = "strip"): string {
  const base = s.normalize("NFKC").toLowerCase().trim();
  return spaces === "collapse" ? base.replace(/\s+/g, " ") : base.replace(/\s+/g, "");
}
