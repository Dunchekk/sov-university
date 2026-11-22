import { db } from "@/server/db";
import type { StudentContext } from "@/server/access";
import { courseMaterialTypes } from "@/modules/courses/materials";
import { filterHref } from "@/shared/lib/filters";
import { dateKey, formatDate } from "@/shared/lib/time";
import type { SearchQuery } from "@/shared/lib/search-text";
import { candidateLimit as take, matching, rows } from "./query";

export function academicResults(student: StudentContext, query: SearchQuery) {
  const own = { studentId: student.id };
  const enrolled = { enrollments: { some: own } };
  return Promise.all([
    rows(
      db.course.findMany({
        where: {
          ...enrolled,
          AND: matching(query, (v) => [
            { name: v },
            { code: v },
            { description: v },
          ]),
        },
        select: { id: true, name: true, code: true, semester: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.name,
        type: "Дисциплины",
        description: `${v.code} · ${v.semester} семестр`,
        aliases: [v.code],
        href: `/studies/courses/${v.id}`,
      }),
    ),

    rows(
      db.assessment.findMany({
        where: {
          course: enrolled,
          AND: matching(query, (v) => [{ title: v }, { instruction: v }]),
        },
        select: {
          id: true,
          title: true,
          kind: true,
          dueAt: true,
          course: { select: { id: true, name: true } },
        },
        orderBy: [{ dueAt: "desc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: v.kind === "EXAM" ? "Экзамены" : "Задания",
        description: `${v.course.name} · ${formatDate(v.dueAt)}`,
        href: `/studies/courses/${v.course.id}?tab=materials#assessment-${encodeURIComponent(v.id)}`,
      }),
    ),

    rows(
      db.fileObject.findMany({
        where: {
          studentId: null,
          course: enrolled,
          OR: courseMaterialTypes.map(({ purpose, mime }) => ({
            purpose,
            mime,
          })),
          AND: matching(query, (v) => [{ originalName: v }]),
        },
        select: { id: true, originalName: true, courseId: true },
        orderBy: [{ originalName: "asc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.originalName,
        type: "Материалы",
        href: `/studies/courses/${v.courseId}?tab=materials#material-${encodeURIComponent(v.id)}`,
      }),
    ),

    rows(
      db.curriculumItem.findMany({
        where: {
          programId: student.group.programId,
          AND: matching(query, (v) => [
            { title: v },
            { category: v },
            { description: v },
          ]),
        },
        select: { id: true, title: true, semester: true, category: true },
        orderBy: [{ semester: "asc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Учебный план",
        description: `${v.semester} семестр · ${v.category}`,
        href: `/studies/curriculum?semester=${v.semester}#curriculum-${encodeURIComponent(v.id)}`,
      }),
    ),

    rows(
      db.studentProject.findMany({
        where: {
          ...own,
          AND: matching(query, (v) => [
            { title: v },
            { kind: v },
            { description: v },
          ]),
        },
        select: { id: true, title: true, kind: true },
        orderBy: [{ dueAt: "desc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Проекты",
        description: v.kind,
        href: `/studies/projects/${v.id}`,
      }),
    ),

    rows(
      db.achievement.findMany({
        where: {
          ...own,
          AND: matching(query, (v) => [
            { title: v },
            { category: v },
            { organizer: v },
          ]),
        },
        select: { id: true, title: true, category: true },
        orderBy: [{ date: "desc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Достижения",
        description: v.category,
        href: `/studies/achievements/${v.id}`,
      }),
    ),
  ]).then((result) => result.flat());
}

export function calendarResults(student: StudentContext, query: SearchQuery) {
  const own = { studentId: student.id };
  const href = (id: string, date: string) =>
    filterHref("/calendar", { date, event: id });
  return Promise.all([
    rows(
      db.lesson.findMany({
        where: {
          groupId: student.groupId,
          course: { enrollments: { some: own } },
          AND: matching(query, (v) => [
            { title: v },
            { kind: v },
            { course: { name: v } },
            { lecturer: { name: v } },
            { room: { name: v } },
          ]),
        },
        select: {
          id: true,
          title: true,
          kind: true,
          startsAt: true,
          cancelled: true,
        },
        orderBy: [{ startsAt: "desc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Расписание",
        description: `${formatDate(v.startsAt)} · ${v.kind}${v.cancelled ? " · отменено" : ""}`,
        href: href(v.id, dateKey(v.startsAt)),
      }),
    ),

    rows(
      db.retake.findMany({
        where: {
          enrollment: own,
          AND: matching(query, (v) => [{ title: v }, { location: v }]),
        },
        select: { id: true, title: true, startsAt: true },
        orderBy: [{ startsAt: "desc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Пересдачи",
        description: formatDate(v.startsAt),
        href: href(v.id, dateKey(v.startsAt)),
      }),
    ),

    rows(
      db.personalEvent.findMany({
        where: {
          ...own,
          deletedAt: null,
          AND: matching(query, (v) => [{ title: v }]),
        },
        select: { id: true, title: true, startDate: true, startsAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Личные события",
        href: href(v.id, v.startDate ?? dateKey(v.startsAt ?? undefined)),
      }),
    ),

    rows(
      db.importedEvent.findMany({
        where: {
          source: { ...own, deletedAt: null },
          cancelled: false,
          AND: matching(query, (v) => [{ title: v }, { source: { name: v } }]),
        },
        select: {
          id: true,
          title: true,
          startDate: true,
          startsAt: true,
          source: { select: { name: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take,
      }),
      (v) => ({
        id: v.id,
        title: v.title,
        type: "Импортированный календарь",
        description: v.source.name,
        href: href(v.id, v.startDate ?? dateKey(v.startsAt ?? undefined)),
      }),
    ),
  ]).then((result) => result.flat());
}
