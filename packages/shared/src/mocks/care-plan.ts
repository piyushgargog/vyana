import type { GenerateCarePlanRes } from "../contracts";
import { mockAiMeta } from "./ai-meta";

// A doctor-generated draft (status "draft") awaiting approval. No medicines or doses, by design (plan §2A).
export const carePlanMock: GenerateCarePlanRes = {
  care_plan_id: "cad8c066-0703-444d-ae62-a4663787c3e9",
  status: "draft",
  plan: {
    condition: "Type 2 Diabetes",
    summary: "Keep blood sugar steady with regular meals, daily activity and the follow-up tests your doctor asks for.",
    do: ["Walk or exercise for about 30 minutes on most days", "Check your feet daily for cuts or sores", "Keep meal times regular"],
    dont: ["Skip meals", "Drink sugary drinks", "Walk barefoot outdoors"],
    diet: {
      eat_more: ["Whole grains such as millets and whole wheat", "Dals and legumes", "Leafy greens and non-starchy vegetables"],
      limit: ["Sugar and sweets", "White rice and maida", "Fried foods"],
      sample_day: [
        { meal: "breakfast", items: ["Vegetable besan chilla", "Unsweetened tea"] },
        { meal: "lunch", items: ["2 multigrain rotis", "Dal", "Mixed vegetable sabzi", "Salad"] },
        { meal: "snack", items: ["Roasted chana"] },
        { meal: "dinner", items: ["Millet khichdi", "Curd", "Sautéed greens"] },
      ],
    },
    red_flags: ["Very high or very low sugar with confusion or fainting", "Chest pain or breathlessness", "A foot wound that is not healing"],
    follow_up_tests: [{ test: "HbA1c", every_days: 90 }, { test: "Kidney function (creatinine)", every_days: 180 }],
    sources: [
      { title: "Diabetes – World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/diabetes" },
      { title: "Type 2 diabetes – NHS", url: "https://www.nhs.uk/conditions/type-2-diabetes/" },
    ],
    language: "en",
  },
  ai: mockAiMeta,
};
