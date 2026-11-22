import type { StudentContext } from "@/server/access";
import { searchQuery, searchScore } from "@/shared/lib/search-text";
import { supportFaq } from "@/shared/config/support";
import { accountResults, financeResults, serviceResults } from "./account";
import { academicResults, calendarResults } from "./academic";
import { eventResults, newsResults, peopleResults } from "./directory";
import { sections } from "./sections";
import type { Candidate } from "./query";
import type { SearchResult, SearchScope } from "./types";

const providers = {
  study: academicResults,
  calendar: calendarResults,
  people: peopleResults,
  services: serviceResults,
  finance: financeResults,
  events: eventResults,
  news: newsResults,
  account: accountResults,
};

export async function search(
  student: StudentContext,
  q: string,
  scope: SearchScope = "all",
): Promise<SearchResult[]> {
  const query = searchQuery(q);
  if (query.phrase.length < 2) return [];
  const includes = (category: SearchScope) =>
    scope === "all" || scope === category;
  const groups = await Promise.all(
    Object.entries(providers)
      .filter(([category]) => includes(category as SearchScope))
      .map(([, load]) => load(student, query)),
  );

  const pages: Candidate[] = sections
    .filter(([category]) => includes(category))
    .map(([, href, title, aliases]) => ({
      id: href,
      href,
      title,
      type: "Разделы кабинета",
      score: searchScore(
        query,
        title,
        href === "/profile"
          ? [
              ...aliases,
              student.name,
              student.group.name,
              student.group.program.name,
            ]
          : aliases,
        "",
        true,
      ),
    }));
  const help: Candidate[] = includes("account")
    ? supportFaq.map(([id, title, answer]) => ({
        id,
        title,
        type: "Помощь",
        href: `/support#faq-${id}`,
        score: searchScore(query, title, [], answer),
      }))
    : [];
  const ranked = [...pages, ...help, ...groups.flat()]
    .map((item) => ({
      item,
      score:
        item.score ??
        Math.max(
          1,
          searchScore(query, item.title, item.aliases, item.description),
        ),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.item.title.localeCompare(b.item.title, "ru"),
    );

  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const perType = scope === "all" ? 5 : 12;
  for (const {
    item: { id, title, href, type, description, unreadNotificationId },
  } of ranked) {
    const count = counts.get(type) ?? 0;
    if (count >= perType || seen.has(href)) continue;
    results.push({ id, title, href, type, description, unreadNotificationId });
    seen.add(href);
    counts.set(type, count + 1);
    if (results.length >= 36) break;
  }
  return results;
}
