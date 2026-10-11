import type { NutritionPlanRes } from "../contracts";

export const nutritionPlanMock: NutritionPlanRes = {
  plan_id: "4b92ed10-e980-4f2b-b3b2-103f356f1010",
  conditions: ["Type 2 Diabetes", "Hypertension"],
  summary: "Keep carbohydrates steady across meals, favour whole grains and fibre, and keep salt under 5 g a day.",
  eat_more: ["Whole grains (millets, brown rice, whole wheat roti)", "Dals and legumes", "Leafy greens and non-starchy vegetables", "Low-fat curd and paneer"],
  limit: ["Sugar, sweets and sweetened drinks", "White rice and maida", "Pickles, papad and salty snacks", "Fried foods"],
  sample_day: [
    { meal: "breakfast", items: ["Vegetable besan chilla", "Unsweetened tea"] },
    { meal: "lunch", items: ["2 multigrain rotis", "Dal", "Mixed vegetable sabzi", "Salad"] },
    { meal: "snack", items: ["Roasted chana", "A small apple"] },
    { meal: "dinner", items: ["Millet khichdi", "Curd", "Sautéed greens"] },
  ],
  sources: [
    { title: "Diabetes – World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/diabetes" },
    { title: "Hypertension – World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/hypertension" },
  ],
};
