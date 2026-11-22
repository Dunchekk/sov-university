import { db } from "@/server/db";
import type { StudentContext } from "@/server/access";
import {
  catalogSearchSelect,
  serviceSearchAliases,
  serviceSearchScore,
} from "@/modules/requests/catalog-search";
import { formatDate } from "@/shared/lib/time";
import { statusLabel } from "@/shared/config/statuses";
import type { SearchQuery } from "@/shared/lib/search-text";
import {
  candidateLimit as take,
  matching,
  rows,
  type Candidate,
} from "./query";

export async function serviceResults(
  student: StudentContext,
  query: SearchQuery,
): Promise<Candidate[]> {
  const requestNumber = query.term.match(
    /^(?:(?:обращение|заявление|заявка)\s*)?(?:№\s*)?(\d{1,9})$/iu,
  )?.[1];
  const requestWord = /^(?:обращен|заявк|заявлен|черновик)/u;
  const requestWords = query.words.filter((word) => !requestWord.test(word));
  const explicitRequest = requestWords.length < query.words.length;
  const requests = db.studentRequest
    .findMany({
      where: {
        studentId: student.id,
        ...(requestNumber
          ? { number: Number(requestNumber) }
          : {
              AND: matching({ ...query, words: requestWords }, (v) => [
                { service: { title: v } },
                { service: { keywords: v } },
              ]),
            }),
      },
      select: {
        id: true,
        number: true,
        status: true,
        service: { select: { slug: true, title: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take,
    })
    .then((items) => {
      const represented = new Set<string>();
      return items
        .filter((item) => {
          if (explicitRequest || requestNumber) return true;
          if (represented.has(item.service.slug)) return false;
          represented.add(item.service.slug);
          return true;
        })
        .map((item) => ({
          id: item.id,
          title: `${item.service.title} · № ${String(item.number).padStart(5, "0")}`,
          type: "Обращения",
          description: statusLabel(item.status),
          href:
            item.status === "DRAFT"
              ? `/services/${item.service.slug}?draft=${item.id}`
              : `/requests/${item.id}`,
          score: requestNumber ? 120 : explicitRequest ? 20 : 2,
        }));
    });
  if (requestNumber) return requests;

  const services = rows(
    db.service.findMany({
      where: { active: true },
      select: catalogSearchSelect,
      orderBy: { title: "asc" },
    }),
    (v) => ({
      id: v.slug,
      title: v.title,
      type: "Услуги",
      href: `/services/${v.slug}`,
      description: serviceSearchAliases(v.slug)[0] ?? v.category,
      score: serviceSearchScore(query, v),
    }),
  );
  return (await Promise.all([services, requests])).flat();
}

export function financeResults(student: StudentContext, query: SearchQuery) {
  const own = { studentId: student.id };
  return Promise.all([
    rows(
      db.contract.findMany({
        where: { ...own, AND: matching(query, (v) => [{ title: v }]) },
        select: { id: true, title: true },
        orderBy: { id: "asc" },
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Договоры",
        href: `/finance?tab=contracts#contract-${encodeURIComponent(v.id)}`,
      }),
    ),

    rows(
      db.payment.findMany({
        where: {
          ...own,
          AND: matching(query, (v) => [{ title: v }, { period: v }]),
        },
        select: { id: true, title: true, date: true },
        orderBy: [{ date: "desc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Выплаты",
        description: formatDate(v.date),
        href: `/finance?tab=payments#payment-${encodeURIComponent(v.id)}`,
      }),
    ),

    rows(
      db.campaign.findMany({
        where: {
          endsAt: { gte: new Date() },
          AND: matching(query, (v) => [{ title: v }, { description: v }]),
        },
        select: { id: true, title: true },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Стипендиальные кампании",
        href: `/finance?tab=scholarships#campaign-${encodeURIComponent(v.id)}`,
      }),
    ),
  ]).then((result) => result.flat());
}

export function accountResults(student: StudentContext, query: SearchQuery) {
  const own = { studentId: student.id };
  return Promise.all([
    rows(
      db.studentOrder.findMany({
        where: { ...own, AND: matching(query, (v) => [{ title: v }]) },
        select: { id: true, title: true, date: true },
        orderBy: [{ date: "desc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Учебные приказы",
        description: formatDate(v.date),
        href: `/profile?tab=history#order-${encodeURIComponent(v.id)}`,
      }),
    ),

    rows(
      db.notification.findMany({
        where: { ...own, AND: matching(query, (v) => [{ title: v }]) },
        select: {
          id: true,
          title: true,
          href: true,
          createdAt: true,
          readAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Уведомления",
        description: formatDate(v.createdAt),
        href: /^\/(?![\\/])/u.test(v.href) ? v.href : "/notifications",
        unreadNotificationId: v.readAt ? undefined : v.id,
      }),
    ),
  ]).then((result) => result.flat());
}
