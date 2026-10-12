import type { InteractionsRes } from "../contracts";
import { mockAiMeta } from "./ai-meta";

// Mock data for building the UI. A real result only lists interactions a fetched source states (with its quote).
export const interactionsMock: InteractionsRes = {
  checked_medicines: ["Metformin 500 mg", "Telma 40 mg", "Dolo 650 mg"],
  interactions: [
    {
      medicine_a: "Metformin 500 mg",
      medicine_b: "Alcohol",
      severity: "major",
      effect: "Sample: raises the risk of a rare but serious side effect.",
      advice: "Sample advice: ask your doctor before drinking alcohol while on this medicine.",
      quote: "Sample quote from the source page, shown word for word in the real response.",
      sources: [{ title: "Sample source (mock)", url: "https://medlineplus.gov" }],
    },
  ],
  sources_checked: [
    { title: "Sample source (mock)", url: "https://medlineplus.gov" },
    { title: "Sample source 2 (mock)", url: "https://www.nhs.uk" },
  ],
  cached: false,
  ai: mockAiMeta,
};
