import { db } from "@/server/db";
import type { StudentContext } from "@/server/access";
export async function requestOptions(student: StudentContext) {
  const [contracts, orders, campaigns, achievements] = await Promise.all([
    db.contract.findMany({
      where: { studentId: student.id },
      select: { id: true, number: true, payer: true },
    }),
    db.studentOrder.findMany({
      where: { studentId: student.id },
      select: { id: true, title: true },
    }),
    db.campaign.findMany({
      where: { startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
      select: { id: true, title: true },
    }),
    db.achievement.findMany({
      where: { studentId: student.id, status: "CONFIRMED" },
      select: { id: true, title: true },
    }),
  ]);
  return {
    contractId: contracts.map((c) => ({
      value: c.id,
      label: `${c.number} · ${c.payer}`,
    })),
    orderId: orders.map((c) => ({ value: c.id, label: c.title })),
    campaignId: campaigns.map((c) => ({ value: c.id, label: c.title })),
    achievementIds: achievements.map((c) => ({ value: c.id, label: c.title })),
  };
}
