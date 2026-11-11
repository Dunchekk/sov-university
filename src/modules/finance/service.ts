import { db } from "@/server/db";
import type { StudentContext } from "@/server/access";
export async function finances(student: StudentContext) {
  const [payments, contracts, awards, campaigns] = await Promise.all([
    db.payment.findMany({
      where: { studentId: student.id },
      orderBy: { date: "desc" },
      take: 100,
    }),
    db.contract.findMany({
      where: { studentId: student.id },
      include: {
        payments: { orderBy: { dueAt: "asc" } },
        files: { select: { id: true, originalName: true } },
      },
    }),
    db.scholarshipAward.findMany({
      where: { studentId: student.id },
      include: { campaign: { select: { title: true } } },
    }),
    db.campaign.findMany({
      where: { endsAt: { gte: new Date() } },
      orderBy: { endsAt: "asc" },
    }),
  ]);
  return { payments, contracts, awards, campaigns };
}
