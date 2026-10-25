import "server-only";

/**
 * Registration-number matching for the manual doctor check (issue #344). Copied unchanged from
 * `tinyfish/nmc.ts`, which goes away with the rest of that folder: an admin checks the public register
 * by hand, and these two helpers keep the "one registration, one account" rule.
 */

/** "MCI/12-345" and "mci 12345" are the same number. */
export const normalizeRegNo = (s: string) => s.toLowerCase().replace(/[\s./\\-]+/g, "");

const COUNCIL_FILLER = new Set(["state", "medical", "council", "of", "the"]);
export const councilKey = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w && !COUNCIL_FILLER.has(w))
    .join(" ");
