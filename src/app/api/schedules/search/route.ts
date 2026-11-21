import { containsText } from "@/shared/lib/filters";
import { route } from "@/server/http";
import { db } from "@/server/db";
export const GET = route(async (request) => {
  const name = containsText(
    (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80),
  );
  const [groups, lecturers, rooms] = await Promise.all([
    db.group.findMany({
      where: { name },
      take: 8,
      select: { id: true, name: true },
    }),
    db.person.findMany({
      where: {
        name,
        OR: [{ courses: { some: {} } }, { lessons: { some: {} } }],
      },
      take: 8,
      select: { id: true, name: true },
    }),
    db.room.findMany({
      where: { name },
      take: 8,
      select: { id: true, name: true, building: true },
    }),
  ]);
  return [
    ...groups.map((i) => ({ ...i, kind: "group", label: i.name })),
    ...lecturers.map((i) => ({ ...i, kind: "lecturer", label: i.name })),
    ...rooms.map((i) => ({
      ...i,
      kind: "room",
      label: `${i.building} · ${i.name}`,
    })),
  ];
});
