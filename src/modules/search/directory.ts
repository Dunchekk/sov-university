import { db } from "@/server/db";
import type { StudentContext } from "@/server/access";
import { communityAudience } from "@/modules/community/service";
import { filterHref } from "@/shared/lib/filters";
import { formatDate } from "@/shared/lib/time";
import type { SearchQuery } from "@/shared/lib/search-text";
import { candidateLimit as take, matching, rows } from "./query";

export function peopleResults(student: StudentContext, query: SearchQuery) {
  return Promise.all([
    rows(
      db.person.findMany({
        where: {
          AND: matching(query, (v) => [
            { name: v },
            { department: v },
            { email: v },
            { profile: { is: { topics: v } } },
            { courses: { some: { name: v } } },
          ]),
        },
        select: { id: true, name: true, department: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.name,
        type: "Преподаватели",
        description: v.department,
        href: `/people/${v.id}`,
      }),
    ),

    rows(
      db.department.findMany({
        where: {
          AND: matching(query, (v) => [
            { name: v },
            { description: v },
            { location: v },
            { email: v },
          ]),
        },
        select: { id: true, name: true, location: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.name,
        type: "Подразделения",
        description: v.location,
        href: filterHref("/people", { tab: "departments", q: v.name }),
      }),
    ),

    rows(
      db.rosterPerson.findMany({
        where: {
          groupId: student.groupId,
          AND: matching(query, (v) => [{ name: v }]),
        },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.name,
        type: "Моя группа",
        description: student.group.name,
        href: filterHref("/people", { tab: "group", q: v.name }),
      }),
    ),
  ]).then((result) => result.flat());
}

export function eventResults(student: StudentContext, query: SearchQuery) {
  return rows(
    db.communityEvent.findMany({
      where: {
        ...communityAudience(student.groupId),
        AND: matching(query, (v) => [
          { title: v },
          { description: v },
          { city: v },
          { organizer: v },
          { category: v },
        ]),
      },
      select: { id: true, title: true, city: true, startsAt: true },
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      take,
    }),
    (v) => ({
      id: v.id,
      title: v.title,
      type: "События",
      description: `${formatDate(v.startsAt)} · ${v.city}`,
      href: `/community/${v.id}`,
    }),
  );
}

export function newsResults(student: StudentContext, query: SearchQuery) {
  return rows(
    db.newsPost.findMany({
      where: {
        ...communityAudience(student.groupId),
        publishedAt: { lte: new Date() },
        AND: matching(query, (v) => [
          { title: v },
          { body: v },
          { city: v },
          { category: v },
        ]),
      },
      select: { id: true, title: true, city: true, publishedAt: true },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take,
    }),
    (v) => ({
      id: v.id,
      title: v.title,
      type: "Новости",
      description: `${formatDate(v.publishedAt)} · ${v.city}`,
      href: `/community/news/${v.id}`,
    }),
  );
}
