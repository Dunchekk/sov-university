import { containsText } from "@/shared/lib/filters";
import { searchPrefixes, type SearchQuery } from "@/shared/lib/search-text";
import type { SearchResult } from "./types";

export type Candidate = SearchResult & {
  aliases?: readonly string[];
  score?: number;
};

export const candidateLimit = 24;

export function matching<T>(
  query: SearchQuery,
  fields: (text: ReturnType<typeof containsText>) => T[],
) {
  return query.words.map((word) => ({
    OR: searchPrefixes(word).flatMap((prefix) => fields(containsText(prefix))),
  }));
}

export async function rows<T>(
  query: PromiseLike<T[]>,
  map: (row: T) => Candidate,
) {
  return (await query).map(map);
}
