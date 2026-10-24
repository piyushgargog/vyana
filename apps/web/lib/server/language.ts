import "server-only";
import { Language } from "@vyana/shared";

/**
 * The one place a user's language is settled (issue #543): an explicit choice in the request wins,
 * otherwise the stored preference is used, and anything missing or unrecognised falls back to English.
 *
 * Callers pass the override and the raw stored value, never a profile, because a caller may be
 * resolving the language of a different user whose profile it fetched itself (the care plan reads
 * the patient's profile through the admin client).
 */
export function resolveLanguage(override: Language | undefined | null, raw: unknown): Language {
  return override ?? Language.catch("en").parse(raw);
}
