export const university = {
  type: "Университет",
  disciplines: "связи, оптики и вычислений",
} as const;

export const brand = {
  name: "СОВ",
  university: `${university.type} ${university.disciplines}`,
  disclaimer: "Учебный прототип. Данные вымышлены.",
} as const;
