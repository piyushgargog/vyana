// packages/shared/src/text/clean.ts
// One-line text cleaner for user-typed text (medical ID, blood requests, search
// links): whitespace collapses to single spaces, the ends are trimmed, and the
// result is capped at `max` characters. Kept here so the rule is tested once,
// not re-typed per screen.

/** Collapses whitespace to single spaces, trims, and caps at `max` characters. */
export const cleanInlineText = (text: string | null | undefined, max: number): string =>
  (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * A test name reduced to lower-case letters and digits, so "HbA1c" and "Hb A1c" compare equal.
 * Used by the follow-up reminder matcher, where case, spaces and punctuation carry no meaning.
 */
export function normaliseTestName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
