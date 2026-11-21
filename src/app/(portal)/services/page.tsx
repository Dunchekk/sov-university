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
  ui,
} from "@/shared/ui/primitives";
import { statusLabel } from "@/shared/config/statuses";
import { formatDate } from "@/shared/lib/time";
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    category?: string;
    page?: string;
  }>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const query = (p.q ?? "").slice(0, 80);
  const page = Math.max(1, Number(p.page) || 1);
  const [services, requests, count] = await Promise.all([
    p.tab === "requests"
      ? []
      : db.service.findMany({
          where: {
            active: true,
            ...(p.category ? { category: p.category } : {}),
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { keywords: { contains: query, mode: "insensitive" } },
            ],
          },
          orderBy: { title: "asc" },
        }),
    p.tab === "requests"
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
        active={p.tab ?? "catalog"}
        items={[
          { id: "catalog", label: "Каталог услуг", href: "/services" },
          {
            id: "requests",
            label: `Мои обращения · ${count}`,
            href: "/services?tab=requests",
          },
        ]}
      />
      {p.tab === "requests" ? (
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
            {page * 20 < count && (
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
          <form className={ui.filterBar}>
            <label>
              Что нужно?
              <input
                name="q"
                defaultValue={query}
                placeholder="Для работы, оценки, оплата…"
              />
            </label>
            <label>
              Категория
              <select name="category" defaultValue={p.category ?? ""}>
                <option value="">Все услуги</option>
                {[
                  "Обучение",
                  "Результаты",
                  "Финансы",
                  "Документы",
                  "Обращения",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <button className={ui.button}>Найти</button>
          </form>
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
