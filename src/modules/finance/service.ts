import { db } from "@/server/db";
import type { StudentContext } from "@/server/access";
export async function finances(
  student: StudentContext,
  scope: "all" | "payments" | "contracts" | "scholarships" = "all",
) {
  const all = scope === "all";
  const scholarships = all || scope === "scholarships";
  const [payments, contracts, awards, campaigns] = await Promise.all([
    all || scope === "payments"
      ? db.payment.findMany({
          where: { studentId: student.id },
          orderBy: { date: "desc" },
          take: 100,
        })
      : [],
    all || scope === "contracts"
      ? db.contract.findMany({
          where: { studentId: student.id },
          include: {
            payments: { orderBy: { dueAt: "asc" } },
            files: { select: { id: true, originalName: true } },
          },
        })
      : [],
    scholarships
      ? db.scholarshipAward.findMany({
          where: { studentId: student.id },
          include: { campaign: { select: { title: true } } },
        })
      : [],
    scholarships
      ? db.campaign.findMany({
          where: { endsAt: { gte: new Date() } },
          orderBy: { endsAt: "asc" },
        })
      : [],
  ]);
  return { payments, contracts, awards, campaigns };
}
