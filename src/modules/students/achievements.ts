import { brand } from "@/shared/config/brand";

export type Achievement = {
  id: string;
  title: string;
  category: string;
  description: string;
};

const student: Achievement = {
  id: "student",
  title: "Студент",
  category: "Учёба",
  description: `За зачисление в университет «${brand.name}».`,
};

const session: Achievement = {
  id: "session",
  title: "Сессия закрыта",
  category: "Учёба",
  description: "За все сданные экзамены и зачёты одной сессии.",
};

const demoCollections: ReadonlyMap<string, readonly Achievement[]> = new Map([
  [
    "student-a",
    [
      student,
      session,
      {
        id: "dpo",
        title: "ДПО пройдено",
        category: "Дополнительное образование",
        description:
          "За завершение программы дополнительного профессионального образования.",
      },
      {
        id: "team-project",
        title: "Командный проект",
        category: "Проекты",
        description:
          "За успешную защиту учебного проекта, выполненного в команде.",
      },
      {
        id: "volunteer",
        title: "Волонтёр кампуса",
        category: "Вне учёбы",
        description:
          "За помощь в организации университетского события в роли волонтёра.",
      },
    ],
  ],
  [
    "student-b",
    [
      student,
      session,
      {
        id: "credits",
        title: "Больше 30 кредитов за месяц",
        category: "Учёба",
        description:
          "За более чем 30 зачётных единиц, начисленных за один календарный месяц.",
      },
      {
        id: "top-five",
        title: "В пятёрке рейтинга",
        category: "Учёба",
        description:
          "За место в первой пятёрке учебного рейтинга по итогам семестра.",
      },
      {
        id: "hackathon",
        title: "Финалист хакатона",
        category: "Проекты",
        description: "За выход команды в финал университетского хакатона.",
      },
    ],
  ],
]);

export function profileAchievements(studentId: string) {
  return demoCollections.get(studentId) ?? [];
}
