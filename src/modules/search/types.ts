export const searchScopes = [
  { id: "all", label: "Всё" },
  { id: "study", label: "Учёба" },
  { id: "calendar", label: "Календарь" },
  { id: "people", label: "Люди" },
  { id: "services", label: "Справки и заявления" },
  { id: "finance", label: "Финансы" },
  { id: "events", label: "События" },
  { id: "news", label: "Новости" },
  { id: "account", label: "Кабинет" },
] as const;

export type SearchScope = (typeof searchScopes)[number]["id"];

export type SearchResult = {
  id: string;
  title: string;
  type: string;
  href: string;
  description?: string;
  unreadNotificationId?: string;
};
