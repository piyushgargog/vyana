// packages/shared/src/text/clean.ts
// One-line text cleaner for user-typed text (medical ID, blood requests, search
// links): whitespace collapses to single spaces, the ends are trimmed, and the
// result is capped at `max` characters. Kept here so the rule is tested once,
// not re-typed per screen.

/** Collapses whitespace to single spaces, trims, and caps at `max` characters. */
export const cleanInlineText = (text: string | null | undefined, max: number): string =>
  (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * One base normalizer for comparing names ignoring case and whitespace
 * (departments, treatments, cache keys, salt names): NFKC, lowercase, trim,
 * collapse whitespace to single spaces. Every "compare ignoring case" helper
 * in the web server builds on this one chain, so the same name normalises
 * the same way everywhere.
 */
export const normalizeName = (text: string): string =>
  text.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");

/**
 * The whitespace-free form of {@link normalizeName}, for keying a lookup by
 * name ("General Medicine" and "generalmedicine" are the same key). Built on
 * the base normalizer, not a second hand-rolled chain.
 */
export const normalizeNameCompact = (text: string): string => normalizeName(text).replace(/ /g, "");
