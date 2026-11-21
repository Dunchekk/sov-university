export type FilterParams = Record<string, string | string[] | undefined>;

export function filterValue(value: FilterParams[string]) {
  return typeof value === "string" ? value : (value?.[0] ?? "");
}

export function filterPage(value: FilterParams[string]) {
  const page = Number(filterValue(value));
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100) : 1;
}

export function containsText(value: string) {
  // Prisma uses ILIKE for this case. Treat user input as a literal substring.
  return {
    contains: value.replace(/[\\%_]/g, "\\$&"),
    mode: "insensitive" as const,
  };
}

export function filterHref(
  path: string,
  values: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    if (value !== "" && value !== undefined) params.set(name, String(value));
  }
  return params.size ? `${path}?${params}` : path;
}
