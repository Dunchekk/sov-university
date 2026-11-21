"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Avatar, Button, Empty, ui } from "@/shared/ui/primitives";
import { LecturerLink } from "@/shared/ui/LecturerLink";
import { filterHref } from "@/shared/lib/filters";
import {
  rosterFilters,
  rosterQuery,
  type RosterFilters,
} from "./roster-filters";
import type { roster } from "./service";

const subscribe = () => () => {};
type Data = Awaited<ReturnType<typeof roster>>;

export function Roster({
  courseId,
  initial,
  initialFilters,
  teacher,
}: {
  courseId: string;
  initial: Data;
  initialFilters: RosterFilters;
  teacher: { id: string; name: string; email: string; consultation: string };
}) {
  const path = usePathname();
  const params = useSearchParams();
  // Keep the server-rendered list readable until controls can handle input.
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const search = params.toString();
  const [appliedSearch, setAppliedSearch] = useState(search);
  const [filters, setFilters] = useState(() =>
    rosterFilters(Object.fromEntries(params)),
  );
  const [response, setResponse] = useState<{ query: string; data: Data }>();
  const [failedQuery, setFailedQuery] = useState("");
  const { role, group, q, page } = filters;
  const query = rosterQuery({ ...filters, q: q.trim() });
  if (appliedSearch !== search) {
    const next = rosterFilters(Object.fromEntries(params));
    setAppliedSearch(search);
    if (rosterQuery(next) !== query || next.role !== role) setFilters(next);
  }
  const initialQuery = rosterQuery(initialFilters);
  const showStudents = role !== "teacher";
  const showTeacher =
    role !== "student" &&
    teacher.name.toLowerCase().includes(q.trim().toLowerCase());
  const data =
    query === initialQuery
      ? initial
      : response?.query === query
        ? response.data
        : null;
  const failed = showStudents && failedQuery === query;
  const pending = showStudents && !data && !failed;
  const showGroup = initial.groups.length > 1 || !!group;

  function change(values: Partial<RosterFilters>, replace = false) {
    const next = { ...filters, ...values };
    setFilters(next);
    const href = filterHref(path, {
      tab: "people",
      q: next.q.trim(),
      role: next.role,
      group: next.group,
      page: next.page > 1 ? next.page : undefined,
    });
    if (replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
  }

  useEffect(() => {
    if (!showStudents || query === initialQuery) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await fetch(`/api/courses/${courseId}/roster?${query}`, {
          signal: controller.signal,
        });
        if (!result.ok) throw new Error();
        const data: Data = await result.json();
        if (controller.signal.aborted) return;
        setResponse({ query, data });
        setFailedQuery("");
      } catch {
        if (!controller.signal.aborted) setFailedQuery(query);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [courseId, initialQuery, query, showStudents]);

  return (
    <div className={ui.stack}>
      <div className={showGroup ? ui.grid3 : ui.grid2}>
        <input
          className={ui.searchInput}
          disabled={!ready}
          value={q}
          maxLength={80}
          onChange={(event) => change({ q: event.target.value, page: 1 }, true)}
          placeholder="Поиск..."
          aria-label="Найти участника"
        />
        <label>
          Роль
          <select
            disabled={!ready}
            value={role}
            onChange={(event) => change({ role: event.target.value, page: 1 })}
          >
            <option value="">Все участники</option>
            <option value="teacher">Преподаватель</option>
            <option value="student">Студенты</option>
          </select>
        </label>
        {showGroup && (
          <label>
            Группа студентов
            <select
              disabled={!ready || !showStudents}
              value={group}
              onChange={(event) =>
                change({ group: event.target.value, page: 1 })
              }
            >
              <option value="">Все группы</option>
              {initial.groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
              {group && !initial.groups.some((item) => item.id === group) && (
                <option value={group}>Группа недоступна</option>
              )}
            </select>
          </label>
        )}
      </div>
      <div className={ui.stack} aria-busy={pending}>
        {showTeacher && (
          <div className={`${ui.row} ${ui.listItem}`}>
            <Avatar name={teacher.name} />
            <div>
              <h3>
                <LecturerLink {...teacher} />
              </h3>
              <p className={ui.caption}>Преподаватель · {teacher.email}</p>
              <p className={ui.caption}>{teacher.consultation}</p>
            </div>
          </div>
        )}
        {showStudents && data && (
          <>
            <div className={ui.grid2}>
              {data.items.map((person) => (
                <div className={`${ui.row} ${ui.listItem}`} key={person.id}>
                  <Avatar name={person.name} src={person.avatar} />
                  <div>
                    <h3>{person.name}</h3>
                    <p className={ui.caption}>Студент · {person.group.name}</p>
                  </div>
                </div>
              ))}
            </div>
            {(page > 1 || data.total > 20) && (
              <div className={ui.row}>
                <Button
                  disabled={!ready || page === 1}
                  onClick={() => change({ page: page - 1 })}
                >
                  Назад
                </Button>
                <Button
                  disabled={!ready || page >= 100 || page * 20 >= data.total}
                  onClick={() => change({ page: page + 1 })}
                >
                  Далее
                </Button>
                <span className={ui.caption}>
                  Страница {page} · {data.total} участников
                </span>
              </div>
            )}
          </>
        )}
        {!showTeacher &&
          !pending &&
          !failed &&
          (!showStudents || !data?.items.length) && (
            <Empty title="Участники не найдены" />
          )}
        {pending && (
          <p role="status" className={ui.caption}>
            Загрузка участников…
          </p>
        )}
        {failed && (
          <p role="alert" className={ui.error}>
            Не удалось загрузить участников.
          </p>
        )}
      </div>
    </div>
  );
}
