import Link from "next/link";
import { LecturerLink } from "@/shared/ui/LecturerLink";
import { ArrowUpRight, MapPin } from "lucide-react";
import { pageStudent } from "@/server/access";
import { pageData } from "@/server/page-data";
import { db } from "@/server/db";
import { courseResult, roster } from "@/modules/courses/service";
import { GradeBreakdown } from "@/modules/assessment/GradeBreakdown";
import { AttendanceIndicator } from "@/modules/assessment/AttendanceIndicator";
import { Roster } from "@/modules/courses/Roster";
import { rosterFilters } from "@/modules/courses/roster-filters";
import { filterValue, type FilterParams } from "@/shared/lib/filters";
import { CourseMaterials } from "@/modules/courses/CourseMaterials";
import { courseMaterialTypes } from "@/modules/courses/materials";
import {
  Card,
  PageTitle,
  Tabs,
  Badge,
  Empty,
  ui,
} from "@/shared/ui/primitives";
import { formatDate, formatTime, dateKey } from "@/shared/lib/time";
const tabs = [
  ["overview", "Обзор"],
  ["materials", "Материалы и задания"],
  ["assessment", "Оценивание"],
  ["people", "Участники"],
  ["lessons", "Занятия"],
] as const;
export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FilterParams>;
}) {
  const student = await pageStudent();
  const { id } = await params;
  const query = await searchParams;
  const tab =
    tabs.find(([id]) => id === filterValue(query.tab))?.[0] ?? "overview";
  const participants = rosterFilters(query);
  const result = await pageData(courseResult(student, id));
  const course = result.enrollment.course;
  const [files, lessons, people] = await Promise.all([
    tab === "materials"
      ? db.fileObject.findMany({
          where: {
            courseId: id,
            studentId: null,
            purpose: { in: courseMaterialTypes.map(({ purpose }) => purpose) },
          },
          select: {
            id: true,
            purpose: true,
            mime: true,
            originalName: true,
            size: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        })
      : [],
    tab === "lessons"
      ? db.lesson.findMany({
          where: {
            courseId: id,
            groupId: student.groupId,
            endsAt: { gt: new Date() },
          },
          include: { room: true },
          orderBy: { startsAt: "asc" },
          take: 12,
        })
      : [],
    tab === "people"
      ? roster(
          student,
          id,
          participants.q,
          participants.group || undefined,
          participants.page,
        )
      : null,
  ]);
  return (
    <>
      <PageTitle
        title={course.name}
        description={`${course.code} · ${course.semester} семестр · ${student.group.name} · ${course.assessmentType}`}
        action={
          <Link href={`/calendar?course=${id}`} className={ui.button}>
            Расписание
            <ArrowUpRight size={16} />
          </Link>
        }
      />
      <Tabs
        active={tab}
        items={tabs.map(([key, label]) => ({
          id: key,
          label,
          href: `/studies/courses/${id}?tab=${key}`,
        }))}
      />
      {tab === "assessment" ? (
        <GradeBreakdown result={result} />
      ) : tab === "people" && people ? (
        <Card>
          <Roster
            key={id}
            courseId={id}
            initial={people}
            initialFilters={participants}
            teacher={course.lecturer}
          />
        </Card>
      ) : tab === "materials" ? (
        <div className={ui.stack}>
          <CourseMaterials files={files} />
          <Card>
            <h2>Задания и сроки</h2>
            {result.assessments.map((a) => (
              <div key={a.id} className={`${ui.stack} ${ui.listItem}`}>
                <div className={ui.between}>
                  <h3>{a.title}</h3>
                  <Badge tone="danger">
                    {formatDate(a.dueAt)} · {formatTime(a.dueAt)}
                  </Badge>
                </div>
                <p className={ui.muted}>{a.instruction}</p>
                <p className={ui.caption}>
                  {a.maxPoints} баллов
                  {a.mandatory ? " · обязательная работа" : ""}
                </p>
              </div>
            ))}
          </Card>
        </div>
      ) : tab === "lessons" ? (
        <Card>
          <h2>Ближайшие встречи</h2>
          {lessons.map((l) => (
            <Link
              key={l.id}
              href={`/calendar?date=${dateKey(l.startsAt)}&event=${l.id}`}
              className={`${ui.between} ${ui.listLink}`}
            >
              <div>
                <h3>
                  {l.kind}
                  {l.cancelled ? " · отменено" : ""}
                </h3>
                <p className={ui.caption}>
                  {formatDate(l.startsAt)} · {formatTime(l.startsAt)}–
                  {formatTime(l.endsAt)}
                </p>
              </div>
              <span>
                {l.room ? `${l.room.building} · ${l.room.name}` : "Онлайн"}
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
          {!lessons.length && <Empty title="Занятия завершены" />}
        </Card>
      ) : (
        <div className={ui.stack}>
          <div className={ui.grid2}>
            <Card>
              <h2>О дисциплине</h2>
              <p className={ui.muted}>{course.description}</p>
              <hr />
              <h3>
                <LecturerLink {...course.lecturer} />
              </h3>
              <p className={ui.caption}>
                {course.lecturer.department} · {course.lecturer.email}
              </p>
              <p className={ui.caption}>{course.lecturer.consultation}</p>
              <hr />
              <p className={ui.row}>
                <MapPin size={17} />
                Место проведения указано у каждого занятия.
              </p>
            </Card>
            <Card>
              <h2>Твой прогресс</h2>
              <p className={ui.largeNumber}>
                {result.grade.points}
                <span className={ui.muted}> / {result.grade.maximum}</span>
              </p>
              <p className={ui.caption}>Накопленные баллы</p>
              <AttendanceIndicator
                attendance={result.attendance}
                scheme={result.scheme}
              />
              <hr />
              <Link
                className={ui.link}
                href={`/studies/courses/${id}?tab=assessment`}
              >
                Как рассчитывается оценка →
              </Link>
            </Card>
          </div>
          <Card>
            <h2>Организационная информация</h2>
            <p>
              Все материалы и критерии доступны во вкладках курса. Изменения
              занятий публикуются в календаре. Вопросы по результатам можно
              обсудить на консультации преподавателя.
            </p>
            <Link
              className={ui.link}
              href={`/studies/courses/${id}?tab=materials`}
            >
              Перейти к заданиям и материалам →
            </Link>
          </Card>
        </div>
      )}
    </>
  );
}
