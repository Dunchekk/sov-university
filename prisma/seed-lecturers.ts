import { db } from "../src/server/db";
import { demoLecturers } from "./lecturer-content";

const defaultConsultation =
  "Среда, 16:00–17:00. По предварительному обращению в учебный офис.";

export async function seedLecturers() {
  const records = demoLecturers.map((lecturer) => ({
    lecturer,
    id: `lecturer-${lecturer.id}`,
    email: `lecturer${lecturer.id + 1}@example.org`,
  }));

  return db.$transaction(async (tx) => {
    const people = await tx.person.createMany({
      data: records.map(({ lecturer, id, email }) => ({
        id,
        email,
        name: lecturer.name,
        department: lecturer.department,
        consultation: lecturer.consultation ?? defaultConsultation,
      })),
      skipDuplicates: true,
    });
    for (const { lecturer, id, email } of records) {
      if (!lecturer.previousName) continue;
      await tx.person.updateMany({
        where: { id, email, name: lecturer.previousName },
        data: { name: lecturer.name },
      });
    }

    const existing = await tx.person.findMany({
      where: { id: { in: records.map(({ id }) => id) } },
      select: { id: true, email: true },
    });
    const emails = new Map(existing.map(({ id, email }) => [id, email]));
    const profiles = await tx.lecturerProfile.createMany({
      data: records
        .filter(({ id, email }) => emails.get(id) === email)
        .map(({ lecturer, id }) => ({
          personId: id,
          avatar: `/people/avatars/${id}.webp`,
          position: lecturer.position,
          phoneExtension: String(2401 + lecturer.id),
          office: lecturer.office,
          since: lecturer.since,
          biography: lecturer.biography.join("\n\n"),
          education: lecturer.education,
          languages: lecturer.languages ?? ["Русский", "Английский"],
          interests: lecturer.interests,
          topics: lecturer.topics.join("\n"),
        })),
      skipDuplicates: true,
    });
    return { peopleAdded: people.count, profilesAdded: profiles.count };
  });
}
