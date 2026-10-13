import { describe, expect, it } from "vitest";

import { MEAL_CALORIES_MAX, MEAL_DESCRIPTION_MAX } from "../../constants";
import { fakeSupabase } from "./fakeSupabase";
import { addMeal, deleteMeal, listMeals, totalCalories } from "./meals";

const ok = (data: unknown) => ({ data, error: null });

describe("listMeals", () => {
  it("reads the meals of the signed-in patient for one local day, earliest first", async () => {
    const f = fakeSupabase({ responses: { meal_logs: [ok([{ id: "m1" }])] } });
    expect(await listMeals(f.sb, "2026-10-13")).toEqual([{ id: "m1" }]);
    expect(f.argsOf("eq")).toEqual(["patient_id", "user-1"]);
    expect(f.argsOf("order")).toEqual(["logged_at"]);
    const [from, to] = [f.argsOf("gte")[1] as string, f.argsOf("lt")[1] as string];
    expect(new Date(to).getTime() - new Date(from).getTime()).toBeGreaterThan(23 * 3600 * 1000);
  });
});

describe("addMeal", () => {
  it("adds a meal for the signed-in patient with a trimmed description", async () => {
    const f = fakeSupabase({ responses: { meal_logs: [ok({ id: "m1" })] } });
    await addMeal(f.sb, { meal: "lunch", description: "  2 rotis, dal  ", calories: 520 });
    expect(f.argsOf("insert")).toEqual([{ patient_id: "user-1", meal: "lunch", description: "2 rotis, dal", calories: 520 }]);
  });

  it("keeps calories empty when unknown, and a time when given", async () => {
    const f = fakeSupabase({ responses: { meal_logs: [ok({ id: "m1" }), ok({ id: "m2" })] } });
    await addMeal(f.sb, { meal: "snack", description: "A banana" });
    await addMeal(f.sb, { meal: "snack", description: "A banana", calories: null, logged_at: "2026-10-13T10:00:00.000Z" });
    expect(f.argsOf("insert", 0)).toEqual([{ patient_id: "user-1", meal: "snack", description: "A banana", calories: null }]);
    expect(f.argsOf("insert", 1)).toEqual([{ patient_id: "user-1", meal: "snack", description: "A banana", calories: null, logged_at: "2026-10-13T10:00:00.000Z" }]);
  });

  it("accepts 0 calories and the largest allowed entry", async () => {
    const f = fakeSupabase({ responses: { meal_logs: [ok({ id: "a" }), ok({ id: "b" })] } });
    await addMeal(f.sb, { meal: "dinner", description: "Fasting", calories: 0 });
    await addMeal(f.sb, { meal: "dinner", description: "x".repeat(MEAL_DESCRIPTION_MAX), calories: MEAL_CALORIES_MAX });
    expect(f.calls.filter((c) => c.name === "insert")).toHaveLength(2);
  });

  it.each([
    ["an unknown meal type", { meal: "brunch" as never, description: "Toast" }],
    ["an empty description", { meal: "lunch" as const, description: "" }],
    ["a description of spaces", { meal: "lunch" as const, description: "   " }],
    ["a description over the limit", { meal: "lunch" as const, description: "x".repeat(MEAL_DESCRIPTION_MAX + 1) }],
    ["negative calories", { meal: "lunch" as const, description: "Dal", calories: -1 }],
    ["calories over the limit", { meal: "lunch" as const, description: "Dal", calories: MEAL_CALORIES_MAX + 1 }],
    ["fractional calories", { meal: "lunch" as const, description: "Dal", calories: 10.5 }],
    ["calories that are not a number", { meal: "lunch" as const, description: "Dal", calories: Number.NaN }],
    ["a time that is not a date", { meal: "lunch" as const, description: "Dal", logged_at: "yesterday-ish" }],
  ])("refuses %s before asking the database", async (_label, input) => {
    const f = fakeSupabase({ responses: { meal_logs: [ok({ id: "x" })] } });
    await expect(addMeal(f.sb, input)).rejects.toMatchObject({ name: "DbError", code: "invalid_meal" });
    expect(f.calls).toEqual([]);
  });
});

describe("deleteMeal", () => {
  it("removes a meal by id, only among the signed-in patient's own", async () => {
    const f = fakeSupabase({ responses: { meal_logs: [ok(null)] } });
    await deleteMeal(f.sb, "m1");
    expect(f.calls.some((c) => c.name === "delete")).toBe(true);
    expect(f.calls.filter((c) => c.name === "eq").map((c) => c.args)).toEqual([["id", "m1"], ["patient_id", "user-1"]]);
  });

  it("throws the database error", async () => {
    const f = fakeSupabase({ responses: { meal_logs: [{ data: null, error: { message: "denied", code: "42501" } }] } });
    await expect(deleteMeal(f.sb, "m1")).rejects.toMatchObject({ code: "42501" });
  });
});

describe("totalCalories", () => {
  it("adds up the known calories and counts the meals without a number", () => {
    expect(totalCalories([{ calories: 310 }, { calories: null }, { calories: 0 }, { calories: 520 }])).toEqual({ total: 830, known: 3, unknown: 1 });
  });
  it("is zero for a day without meals", () => {
    expect(totalCalories([])).toEqual({ total: 0, known: 0, unknown: 0 });
  });
});
