/**
 * The one shared text pipeline for every safety check (issue #663). Before this, the six safety files each
 * normalized the same text their own way, so one name could match in one check and miss in another ("can't"
 * became "cant" for red flags but stayed "can't" for the blocklist). Everything here builds on `normalizeText`
 * from verbatim.ts, the house standard: NFKC plus lowercase plus dash and quote folding plus space collapse
 * plus trim. Pure functions, no I/O.
 */
import { normalizeText } from "./verbatim";

export { normalizeText };

/**
 * Splits normalized text into words. Apostrophes are dropped first, so "can't" and "cant" are the same word
 * (the red flag patterns spell it "cant"). Hyphens split words, so "chest-pain" is "chest" plus "pain" for the
 * red flag patterns and "Dolo-650" is "dolo" plus "650" for the brand matcher; this matches how the old
 * red flag and condition tokenizers already split, and the salt matcher drops the bare strength number.
 */
export function tokenizeSafetyText(text: string): string[] {
  return normalizeText(text)
    .replace(/'/g, "")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
}

/** One word through the same pipeline, for single terms such as a red flag pattern term. */
export function normalizeSafetyWord(term: string): string {
  return tokenizeSafetyText(term)[0] ?? "";
}
