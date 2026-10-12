import type { InteractionsRes } from "../contracts";
import { mockAiMeta } from "./ai-meta";

// Mock data for building the UI. A real result only lists interactions a fetched source states (with its quote).
// `layer`: "table" = the team-reviewed list, "sources" = found on a trusted page. `not_checked`: medicines whose salt
// is unknown, so the screen must not say they were checked.
export const interactionsMock: InteractionsRes = {
  checked_medicines: ["Ecosprin 75 mg", "Clopilet 75 mg", "Pan 40 mg"],
  interactions: [
    {
      medicine_a: "Ecosprin 75 mg",
      medicine_b: "Clopilet 75 mg",
      severity: "moderate",
      effect: "Sample: taking both may raise the risk of bleeding.",
      advice: "Sample advice: don't stop or change any medicine on your own. Ask your doctor or pharmacist.",
      quote: "Sample quote from the source page, shown word for word in the real response.",
      sources: [{ title: "Sample source (mock)", url: "https://medlineplus.gov" }],
      layer: "sources",
    },
  ],
  sources_checked: [
    { title: "Sample source (mock)", url: "https://medlineplus.gov" },
    { title: "Sample source 2 (mock)", url: "https://www.nhs.uk" },
  ],
  not_checked: ["Shelcal 500"],
  cached: false,
  ai: mockAiMeta,
};
