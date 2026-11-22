import { notFound } from "next/navigation";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { requestDetail } from "@/modules/requests/service";
import { requestOptions } from "@/modules/requests/options";
import { RequestForm } from "@/modules/requests/RequestForm";
import { formDefinitions } from "@/modules/requests/forms";
import { pageData } from "@/server/page-data";
import { PageTitle, Card, ui } from "@/shared/ui/primitives";
export default async function ServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    draft?: string;
    contract?: string;
    campaign?: string;
    subject?: string;
    category?: string;
  }>;
}) {
  const student = await pageStudent();
  const { slug } = await params;
  const p = await searchParams;
  const [service, options] = await Promise.all([
    db.service.findUnique({ where: { slug } }),
    requestOptions(student),
  ]);
  if (!service || !formDefinitions[slug]) notFound();
  const draft = p.draft
    ? await pageData(requestDetail(student, p.draft))
    : null;
  if (draft && (draft.serviceSlug !== slug || draft.status !== "DRAFT"))
    notFound();
  const initial = draft
    ? (draft.fields as Record<string, unknown>)
    : {
        ...(p.contract && options.contractId.some((o) => o.value === p.contract)
          ? { contractId: p.contract }
          : {}),
        ...(p.campaign && options.campaignId.some((o) => o.value === p.campaign)
          ? { campaignId: p.campaign }
          : {}),
        ...(p.subject ? { subject: p.subject.slice(0, 180) } : {}),
        ...(p.category && slug === "general" ? { category: p.category } : {}),
      };
  return (
    <>
      <PageTitle
        title={service.title}
        description={service.summary}
        breadcrumb={{ path: `/services/${encodeURIComponent(slug)}` }}
      />
      <div className={ui.grid2}>
        <Card>
          <RequestForm
            slug={slug}
            title={service.title}
            definitions={formDefinitions[slug]}
            options={options}
            student={{
              name: student.name,
              program: student.group.program.name,
              group: student.group.name,
            }}
            initial={initial}
            draft={draft ? { id: draft.id, version: draft.version } : undefined}
            files={draft?.files}
          />
        </Card>
        <div className={ui.stack}>
          <Card>
            <div className={ui.stack}>
              <h2>Что важно знать</h2>
              <div>
                <h3>Когда может понадобиться</h3>
                <p className={ui.muted}>{service.purpose}</p>
              </div>
              <div>
                <h3>Что подготовить</h3>
                <p className={ui.muted}>{service.requirements}</p>
              </div>
              <div>
                <h3>Что будет в документе</h3>
                <p className={ui.muted}>{service.contents}</p>
              </div>
              <div>
                <h3>Срок и получение</h3>
                <p className={ui.muted}>
                  Ориентировочно {service.workDays} рабочих дней, без учёта
                  праздников. {service.department}. Электронный результат
                  появится в обращении; бумажный — в учебном офисе.
                </p>
              </div>
              <p className={ui.caption}>
                Демонстрационный каталог, не регламент реального университета.
                Уточните у получателя, подходит ли документ.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
