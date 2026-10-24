import { describe, expect, it } from 'vitest';

import { planStrings } from './plan-strings';

describe('planStrings', () => {
  it('falls back to English when the plan language is unknown', () => {
    expect(planStrings(null).summary).toBe('Summary');
    expect(planStrings(undefined).whatToDo).toBe('What to do');
  });

  it('follows the plan language for the screen headings', () => {
    expect(planStrings('hi').summary).toBe('सारांश');
    expect(planStrings('hi').whatToAvoid).toBe('क्या न करें');
    expect(planStrings('hinglish').summary).toBe('Summary');
    expect(planStrings('hinglish').whatToDo).toBe('Kya karein');
  });

  it('labels meals and vitals in the plan language', () => {
    expect(planStrings('hi').mealTypes.breakfast).toBe('नाश्ता');
    expect(planStrings('hinglish').mealTypes.breakfast).toBe('Nashta');
    expect(planStrings('hi').vitalTypes.bp).toBe('ब्लड प्रेशर');
    expect(planStrings('en').vitalTypes.sugar_fasting).toBe('Fasting Sugar');
  });

  it('formats counts and intervals per language', () => {
    expect(planStrings('en').mealsWithoutCalories(1)).toBe('1 meal without calories');
    expect(planStrings('en').mealsWithoutCalories(3)).toBe('3 meals without calories');
    expect(planStrings('hi').everyDays(90)).toBe('हर 90 दिन');
    expect(planStrings('hinglish').everyDays(90)).toBe('Har 90 din');
  });
});
