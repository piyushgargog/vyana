import "server-only";
import type { Language } from "@vyana/shared";

/**
 * The name of a language as written into LLM prompts, so the model answers in the right
 * language and script. One map for every prompt: the assistant, care plan and report
 * summary prompts each wrote their own copy with drifting wording.
 */
export const LANGUAGE_NAME: Record<Language, string> = {
  en: "English",
  hi: "Hindi (Devanagari script)",
  hinglish: "Hinglish (Hindi written in Latin letters, mixed with English)",
};
