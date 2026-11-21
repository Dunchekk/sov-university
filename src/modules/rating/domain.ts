import { dateKey } from "@/shared/lib/time";

export function academicYear(day: Date | string) {
  const [year, month] = dateKey(day).split("-").map(Number);
  return month >= 9 ? year : year - 1;
}

export function ratingSummary(
  grades: { credits: number; grade: number }[],
  cohort?: { referenceCredits: number; scores: number[] } | null,
) {
  if (!grades.length) return null;
  let credits = 0;
  let creditScore = 0;
  let gradeSum = 0;
  let minimum = 10;
  for (const item of grades) {
    credits += item.credits;
    creditScore += item.credits * item.grade;
    gradeSum += item.grade;
    minimum = Math.min(minimum, item.grade);
  }
  if (!credits) return null;
  const reference = cohort?.referenceCredits ?? credits;
  const normalizedScore = Math.round((creditScore * reference * 100) / credits);
  const total = cohort?.scores.length ? cohort.scores.length + 1 : null;
  const place =
    total && cohort
      ? 1 + cohort.scores.filter((score) => score > normalizedScore).length
      : null;
  return {
    credits,
    creditScore,
    normalizedScore: normalizedScore / 100,
    coefficient: reference / credits,
    gpa: creditScore / credits,
    average: gradeSum / grades.length,
    minimum,
    place,
    total,
    topPercent: place && total ? Math.ceil((place * 100) / total) : null,
  };
}
