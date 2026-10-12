import type { TriageRes } from "../contracts";
import { mockAiMeta } from "./ai-meta";

export const TRIAGE_DISCLAIMER = "This is not a diagnosis. If you feel worse or are unsure, see a doctor or call 108.";

export const triageMock: TriageRes = {
  urgency: "routine",
  departments: ["Dermatology"],
  advice: "Book a Dermatology appointment in the next few days. Keep the area clean and avoid scratching.",
  red_flags: ["Rash spreading fast", "Fever with the rash", "Swelling of the face or trouble breathing"],
  disclaimer: TRIAGE_DISCLAIMER,
  ai: mockAiMeta,
};

// Red-flag rules short-circuit the model (plan §2A rule 4).
export const triageEmergencyMock: TriageRes = {
  urgency: "emergency",
  departments: ["Emergency"],
  advice: "Call 108 now or press SOS.",
  red_flags: ["Chest pain or pressure"],
  disclaimer: TRIAGE_DISCLAIMER,
  ai: { ...mockAiMeta, model: "rules" },
};
