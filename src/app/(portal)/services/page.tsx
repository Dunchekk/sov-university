import Link from "next/link";
import { FileText } from "lucide-react";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import {
  Card,
  PageTitle,
  Tabs,
  Badge,
  Empty,
  ActionLink,
  ui,
} from "@/shared/ui/primitives";
import { FilterForm, FilterSelect, FilterText } from "@/shared/ui/FilterForm";
import {
  containsText,
  filterPage,
  filterValue,
  type FilterParams,
} from "@/shared/lib/filters";
import { catalog } from "@/modules/requests/catalog";
import { statusLabel } from "@/shared/config/statuses";
import { formatDate } from "@/shared/lib/time";
const path = "/services";
const categories = [...new Set(catalog.map((service) => service.category))];
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const query = filterValue(p.q).trim().slice(0, 80);
  const category = categories.find(
    (value) => value === filterValue(p.category),
  );
  const tab = filterValue(p.tab) === "requests" ? "requests" : "catalog";
  const page = filterPage(p.page);
  const contains = containsText(query);
  const [services, requests, count] = await Promise.all([
    tab === "requests"
      ? []
      : db.service.findMany({
          where: {
            active: true,
            category,
            OR: [{ title: contains }, { keywords: contains }],
          },
          orderBy: { title: "asc" },
        }),
    tab === "requests"
      ? db.studentRequest.findMany({
          where: { studentId: student.id },
          include: { service: { select: { title: true, slug: true } } },
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * 20,
          take: 20,
        })
      : [],
    db.studentRequest.count({ where: { studentId: student.id } }),
  ]);
  return (
    <>
      <PageTitle
        title="Справки и заявления"
        description="Нужный документ — без лишних формальностей."
      />
      <Tabs
        active={tab}
        items={[
          { id: "catalog", label: "Каталог услуг", href: "/services" },
          {
            id: "requests",
            label: `Мои обращения · ${count}`,
            href: "/services?tab=requests",
          },
        ]}
      />
      {tab === "requests" ? (
        <Card>
          {requests.map((r) => (
            <Link
              key={r.id}
              href={
                r.status === "DRAFT"
                  ? `/services/${r.service.slug}?draft=${r.id}`
                  : `/requests/${r.id}`
              }
              className={`${ui.between} ${ui.listLink}`}
            >
              <div>
                <h3>{r.service.title}</h3>
                <p className={ui.caption}>
                  № {String(r.number).padStart(5, "0")} ·{" "}
                  {formatDate(r.updatedAt)}
                </p>
              </div>
              <Badge
                tone={
                  r.status === "READY"
                    ? "success"
                    : r.status === "NEEDS_INFO"
                      ? "warning"
                      : "default"
                }
              >
                {statusLabel(r.status)}
              </Badge>
            </Link>
          ))}
          {!requests.length && (
            <Empty
              title="Пока нет обращений"
              description="Выберите услугу в каталоге — мы подставим учебные сведения."
            />
          )}
          <div className={ui.row}>
            {page > 1 && (
              <Link
                className={ui.button}
                href={`/services?tab=requests&page=${page - 1}`}
              >
                Назад
              </Link>
            )}
            {page < 100 && page * 20 < count && (
              <Link
                className={ui.button}
                href={`/services?tab=requests&page=${page + 1}`}
              >
                Далее
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className={ui.stack}>
          <FilterForm action={path} className={ui.filterBar}>
            <label>
              Что нужно?
              <FilterText
                name="q"
                value={query}
                maxLength={80}
                placeholder="Для работы, оценки, оплата…"
              />
            </label>
            <label>
              Категория
              <FilterSelect name="category" value={category ?? ""}>
                <option value="">Все услуги</option>
                {categories.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </FilterSelect>
            </label>
            <button className={ui.button}>Найти</button>
          </FilterForm>
          <div className={ui.grid3}>
            {services.map((service) => (
              <Card key={service.slug}>
                <div className={ui.stack}>
                  <div className={ui.between}>
                    <FileText size={21} />
                    <Badge>{service.category}</Badge>
                  </div>
                  <Link href={`/services/${service.slug}`}>
                    <h2>{service.title}</h2>
                  </Link>
                  <p className={ui.muted}>{service.summary}</p>
                  <div className={ui.between}>
                    <small className={ui.caption}>
                      Около {service.workDays} рабочих дней
                    </small>
                    <Link
                      className={ui.link}
                      href={`/services/${service.slug}`}
                    >
                      Открыть →
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {!services.length && (
            <Empty
              title="Услуги не найдены"
              description="Попробуйте другое назначение документа."
              action={
                query || category ? (
                  <ActionLink href={path}>Сбросить фильтры</ActionLink>
                ) : undefined
              }
            />
          )}
          <Card>
            <h3>Специализированные документы</h3>
            <p className={ui.muted}>
              Воинский учёт и документы для иностранных студентов оформляются
              через учебный офис. Личные чувствительные сведения здесь не
              собираются.
            </p>
            <Link className={ui.link} href="/people?tab=departments&q=Учебный">
              Как получить →
            </Link>
          </Card>
        </div>
      )}
    </>
  );
}
