import { describe, expect, it } from "vitest";
import { academicYear, ratingSummary } from "../../src/modules/rating/domain";

describe("rating", () => {
  it("uses the Moscow academic year at the September boundary", () => {
    expect(academicYear("2026-08-31T20:59:59Z")).toBe(2025);
    expect(academicYear("2026-08-31T21:00:00Z")).toBe(2026);
  });

  it("weights and normalizes grades, and shares the same place on ties", () => {
    expect(
      ratingSummary(
        [
          { credits: 5, grade: 9 },
          { credits: 3, grade: 7 },
        ],
        { referenceCredits: 12, scores: [10000, 9900, 8500] },
      ),
    ).toEqual({
      credits: 8,
      creditScore: 66,
      gpa: 8.25,
      average: 8,
      minimum: 7,
      coefficient: 1.5,
      normalizedScore: 99,
      place: 2,
      total: 4,
      topPercent: 50,
    });
  });

  it("leaves the place unset without a cohort and handles an empty year", () => {
    expect(ratingSummary([{ credits: 3, grade: 10 }])).toMatchObject({
      place: null,
      total: null,
      topPercent: null,
      normalizedScore: 30,
    });
    expect(ratingSummary([])).toBeNull();
  });
});
