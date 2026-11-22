import {
  searchQuery,
  searchScore,
  type SearchQuery,
} from "@/shared/lib/search-text";

export const catalogSearchSelect = {
  slug: true,
  title: true,
  category: true,
  summary: true,
  purpose: true,
  contents: true,
  keywords: true,
  department: true,
  workDays: true,
} as const;

export type CatalogSearchItem = Record<
  Exclude<keyof typeof catalogSearchSelect, "workDays">,
  string
> & { workDays: number };

const aliases: Record<string, readonly string[]> = {
  enrollment: [
    "Справка об обучении",
    "Справка с места учёбы",
    "Подтверждение статуса студента",
    "Справка для работы",
  ],
  grades: [
    "Выписка с оценками",
    "Справка об успеваемости",
    "Академическая выписка",
  ],
  transcript: [
    "Транскрипт на английском языке",
    "Выписка с оценками на английском",
    "Transcript of records",
  ],
  "study-period": ["Справка о периоде обучения", "Справка для перевода"],
  "study-leave": ["Справка для учебного отпуска", "Справка вызов на сессию"],
  "scholarship-payments": [
    "Справка о стипендии",
    "Справка о выплатах",
    "Справка о доходах",
  ],
  "tuition-payment": [
    "Справка об оплате обучения",
    "Справка об оплате для налогового вычета",
  ],
  order: ["Выписка из приказа о зачислении", "Приказ о переводе"],
  "document-copy": ["Копия аттестата", "Копия документа об образовании"],
  scholarship: ["Подать заявку на стипендию", "Повышенная стипендия"],
  "support-grant": ["Материальная помощь", "Социальная поддержка"],
  general: ["Написать в учебный офис", "Сообщить об ошибке в данных"],
  support: ["Написать в техподдержку", "Сообщить о проблеме на сайте"],
};

export function serviceSearchAliases(slug: string) {
  return aliases[slug] ?? [];
}

export function serviceSearchScore(
  query: SearchQuery,
  service: CatalogSearchItem,
) {
  return searchScore(
    query,
    service.title,
    serviceSearchAliases(service.slug),
    [
      service.category,
      service.summary,
      service.purpose,
      service.contents,
      service.keywords,
      service.department,
    ].join(" "),
    true,
  );
}

export function filterCatalog(
  services: CatalogSearchItem[],
  value: string,
  category: string,
) {
  const query = searchQuery(value);
  return services
    .filter((service) => !category || service.category === category)
    .map((service) => ({
      service,
      score: query.term ? serviceSearchScore(query, service) : 1,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ service }) => service);
}
