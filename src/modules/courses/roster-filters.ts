import {
  filterPage,
  filterValue,
  type FilterParams,
} from "@/shared/lib/filters";

export function rosterFilters(params: FilterParams) {
  return {
    q: filterValue(params.q).trim().slice(0, 80),
    group: filterValue(params.group).slice(0, 100),
    page: filterPage(params.page),
  };
}

export type RosterFilters = ReturnType<typeof rosterFilters>;

export function rosterQuery({ q, group, page }: RosterFilters) {
  return new URLSearchParams({ q, group, page: String(page) }).toString();
}
