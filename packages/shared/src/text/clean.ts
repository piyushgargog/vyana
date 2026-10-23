// packages/shared/src/text/clean.ts
// One-line text cleaner for user-typed text (medical ID, blood requests, search
// links): whitespace collapses to single spaces, the ends are trimmed, and the
// result is capped at `max` characters. Kept here so the rule is tested once,
// not re-typed per screen.

/** Collapses whitespace to single spaces, trims, and caps at `max` characters. */
export const cleanInlineText = (text: string | null | undefined, max: number): string =>
  (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
