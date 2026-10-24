// packages/shared/src/text/clean.ts
// One-line text cleaner for user-typed text (medical ID, blood requests, search
// links): whitespace collapses to single spaces, the ends are trimmed, and the
// result is capped at `max` characters. Kept here so the rule is tested once,
// not re-typed per screen.

/**
 * Collapses whitespace to single spaces, trims, and caps at `max` characters.
 * The cap counts code points, not UTF-16 units: slicing at `max` units can split
 * an astral character in half, and the lone surrogate left behind makes
 * `encodeURIComponent` throw when the search-link builders use the result.
 */
export const cleanInlineText = (text: string | null | undefined, max: number): string =>
  [...(text ?? "").replace(/\s+/g, " ").trim()].slice(0, max).join("");
