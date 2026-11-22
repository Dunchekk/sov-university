import Link from "next/link";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import {
  Card,
  PageTitle,
  Tabs,
  Badge,
  Empty,
  ui,
} from "@/shared/ui/primitives";
import {
  filterPage,
  filterValue,
  type FilterParams,
} from "@/shared/lib/filters";
import { ServiceCatalog } from "@/modules/requests/ServiceCatalog";
import { catalogSearchSelect } from "@/modules/requests/catalog-search";
import { statusLabel } from "@/shared/config/statuses";
import { formatDate } from "@/shared/lib/time";
import s from "./services.module.css";
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const tab = filterValue(p.tab) === "requests" ? "requests" : "catalog";
  const page = filterPage(p.page);
  const [services, requests, count] = await Promise.all([
    tab === "requests"
      ? []
      : db.service.findMany({
          where: { active: true },
          orderBy: { title: "asc" },
          select: catalogSearchSelect,
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
  const hasNextPage = page < 100 && page * 20 < count;
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
        <Card className={s.requests}>
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
          {(page > 1 || hasNextPage) && (
            <nav
              className={`${ui.row} ${s.pages}`}
              aria-label="Страницы обращений"
            >
              {page > 1 && (
                <Link
                  className={ui.button}
                  href={`/services?tab=requests&page=${page - 1}`}
                >
                  Назад
                </Link>
              )}
              {hasNextPage && (
                <Link
                  className={ui.button}
                  href={`/services?tab=requests&page=${page + 1}`}
                >
                  Далее
                </Link>
              )}
            </nav>
          )}
        </Card>
      ) : (
        <ServiceCatalog services={services} />
      )}
    </>
  );
}
