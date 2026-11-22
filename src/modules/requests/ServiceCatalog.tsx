"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Card, Empty, ui } from "@/shared/ui/primitives";
import { filterHref } from "@/shared/lib/filters";
import { filterCatalog, type CatalogSearchItem } from "./catalog-search";
import s from "./catalog.module.css";

const filterChange = "catalog-filter-change";

function subscribeToFilters(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(filterChange, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(filterChange, onChange);
  };
}

const browserSearch = () => window.location.search.slice(1);

export function ServiceCatalog({
  services,
}: {
  services: CatalogSearchItem[];
}) {
  const routerParams = useSearchParams();
  const search = useSyncExternalStore(subscribeToFilters, browserSearch, () =>
    routerParams.toString(),
  );
  const params = new URLSearchParams(search);
  const query = (params.get("q") ?? "").slice(0, 80);
  const categories = [
    ...new Set(services.map((service) => service.category)),
  ].sort();
  const category =
    categories.find((value) => value === params.get("category")) ?? "";
  const visible = filterCatalog(services, query, category);

  function apply(q: string, selected: string) {
    const href = filterHref("/services", { q, category: selected });
    if (window.location.pathname + window.location.search === href) return;
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new Event(filterChange));
  }

  return (
    <div className={`${ui.stack} ${s.catalog}`}>
      <form
        className={s.filters}
        role="search"
        aria-label="Каталог услуг"
        onSubmit={(event) => event.preventDefault()}
      >
        <label>
          Поиск услуг
          <input
            name="q"
            maxLength={80}
            placeholder="Поиск..."
            value={query}
            onChange={(event) => apply(event.target.value, category)}
          />
        </label>
        <label>
          Категория
          <select
            name="category"
            value={category}
            onChange={(event) => apply(query, event.target.value)}
          >
            <option value="">Все услуги</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </form>
      <p role="status" className={ui.srOnly}>
        Услуг найдено: {visible.length}
      </p>
      {visible.length ? (
        <div className={s.grid}>
          {visible.map((service) => (
            <article className={s.card} key={service.slug}>
              <Link className={s.title} href={`/services/${service.slug}`}>
                <h2>{service.title}</h2>
              </Link>
              <Badge>{service.category}</Badge>
              <p className={s.summary}>{service.summary}</p>
              <small className={ui.caption}>
                Около {service.workDays} рабочих дней
              </small>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Услуги не найдены"
          description="Попробуйте другое название или категорию."
          action={
            query || category ? (
              <Button type="button" onClick={() => apply("", "")}>
                Сбросить фильтры
              </Button>
            ) : undefined
          }
        />
      )}
      <Card>
        <h3>Специализированные документы</h3>
        <p className={ui.muted}>
          Воинский учёт и документы для иностранных студентов оформляются через
          учебный офис. Личные чувствительные сведения здесь не собираются.
        </p>
        <Link className={ui.link} href="/people?tab=departments&q=Учебный">
          Как получить →
        </Link>
      </Card>
    </div>
  );
}
