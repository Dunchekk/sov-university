import Link from "next/link";
import { ArrowUpRight, Download } from "lucide-react";
import { pageStudent } from "@/server/access";
import { finances } from "@/modules/finance/service";
import {
  PageTitle,
  Card,
  Tabs,
  Badge,
  Empty,
  ui,
} from "@/shared/ui/primitives";
import { formatDate, money } from "@/shared/lib/time";
import { statusLabel } from "@/shared/config/statuses";
import { brand } from "@/shared/config/brand";
import s from "./finance.module.css";
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const student = await pageStudent();
  const { tab = "overview" } = await searchParams;
  const data = await finances(
    student,
    tab === "contracts" || tab === "scholarships" ? tab : "payments",
  );
  const expected = data.payments.filter((p) => p.status === "EXPECTED");
  const paid = data.payments
    .filter((p) => p.status === "PAID")
    .reduce((n, p) => n + p.amountKopecks, 0);
  return (
    <>
      <PageTitle
        title="Финансы"
        description="Выплаты, стипендии и договоры — с понятными статусами."
      />
      <Tabs
        active={tab}
        items={[
          ["overview", "Обзор"],
          ["scholarships", "Стипендии"],
          ["payments", "Выплаты"],
          ["contracts", "Договоры"],
        ].map(([id, label]) => ({ id, label, href: `/finance?tab=${id}` }))}
      />
      {tab === "scholarships" ? (
        <div className={ui.stack}>
          {data.awards.map((a) => (
            <Card key={a.id}>
              <Badge tone="success">Текущее назначение</Badge>
              <h2>Академическая стипендия</h2>
              <p className={ui.largeNumber}>
                {money(a.amountKopecks)}
                <small className={ui.caption}> / месяц</small>
              </p>
              <p className={ui.muted}>
                {formatDate(a.startsAt)}–{formatDate(a.endsAt)}
              </p>
            </Card>
          ))}
          <h2>Открытые кампании</h2>
          {data.campaigns.map((c) => (
            <Card key={c.id} id={`campaign-${c.id}`}>
              <div className={ui.stack}>
                <div className={ui.between}>
                  <h2>{c.title}</h2>
                  <Badge tone="info">
                    {c.startsAt <= new Date()
                      ? "Можно подать"
                      : "Скоро открытие"}
                  </Badge>
                </div>
                <p>{c.description}</p>
                <p className={ui.muted}>{c.criteria}</p>
                <p>
                  Приём: {formatDate(c.startsAt)}–{formatDate(c.endsAt)}
                </p>
                {c.amountKopecks && (
                  <p>Демонстрационный размер: {money(c.amountKopecks)}</p>
                )}
                {c.startsAt <= new Date() && (
                  <Link
                    href={`/services/scholarship?campaign=${c.id}`}
                    className={`${ui.button} ${ui.primary}`}
                  >
                    Подать заявку
                  </Link>
                )}
                <p className={ui.caption}>
                  Возможность подать заявку не гарантирует назначение выплаты.
                  Подготовьте подтверждённые достижения.
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : tab === "payments" ? (
        <Card>
          <div className={ui.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Назначение</th>
                  <th>Период</th>
                  <th>Сумма</th>
                  <th>Дата</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} id={`payment-${p.id}`}>
                    <td>{p.title}</td>
                    <td>{p.period}</td>
                    <td>{money(p.amountKopecks)}</td>
                    <td>{formatDate(p.date)}</td>
                    <td>
                      <Badge tone={p.status === "PAID" ? "success" : "default"}>
                        {statusLabel(p.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.payments.length && (
            <Empty
              title="Выплат пока нет"
              description="Назначения и начисления появятся здесь."
            />
          )}
          <Link href="/services/scholarship-payments" className={ui.link}>
            Заказать сведения о выплатах →
          </Link>
        </Card>
      ) : tab === "contracts" ? (
        <div className={ui.stack}>
          <h2>Мои договоры</h2>
          {data.contracts.map((c) => (
            <Card key={c.id} id={`contract-${c.id}`}>
              <div className={ui.stack}>
                <div className={ui.between}>
                  <div>
                    <h3>Договор об образовании с {brand.name}</h3>
                    <p className={ui.caption}>№ {c.number}</p>
                  </div>
                  <Badge>{c.status}</Badge>
                </div>
                <p>{c.title}</p>
                <p className={ui.caption}>Плательщик: {c.payer}</p>
                <p className={ui.largeNumber}>{money(c.totalKopecks)}</p>
                <p className={ui.muted}>{c.supplement}</p>
                <div className={ui.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Срок</th>
                        <th>Сумма</th>
                        <th>Состояние</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.payments.map((p) => (
                        <tr key={p.id}>
                          <td>{formatDate(p.dueAt)}</td>
                          <td>{money(p.amountKopecks)}</td>
                          <td>
                            {p.paid
                              ? "Оплачено"
                              : p.dueAt < new Date()
                                ? "Срок прошёл"
                                : "Предстоит"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={ui.row}>
                  {c.files.map((f) => (
                    <a
                      className={ui.button}
                      key={f.id}
                      href={`/api/files/${f.id}`}
                    >
                      <Download size={16} aria-hidden />
                      Скачать договор (PDF)
                    </a>
                  ))}
                  <Link
                    className={`${ui.button} ${ui.primary}`}
                    href={`/services/tuition-payment?contract=${c.id}`}
                  >
                    Заказать справку об оплате
                  </Link>
                  <Link
                    className={ui.button}
                    href="/services/general?category=FINANCE&subject=Вопрос%20по%20договору"
                  >
                    Задать вопрос
                  </Link>
                </div>
              </div>
            </Card>
          ))}
          {!data.contracts.length && (
            <Card>
              <Empty
                title="Нет договоров на оплату обучения"
                description="Вы учитесь на бюджетном месте."
              />
            </Card>
          )}
        </div>
      ) : (
        <div className={ui.stack}>
          <div className={ui.grid3}>
            <Card className={s.summaryCard}>
              <p className={ui.caption}>Следующая ожидаемая выплата</p>
              <p className={`${ui.largeNumber} ${s.summaryValue}`}>
                {expected[0]
                  ? money(expected[0].amountKopecks)
                  : "Нет назначений"}
              </p>
              <p className={ui.caption}>
                {expected[0]
                  ? `${formatDate(expected[0].date)} · ещё не выплачено`
                  : "Открытые кампании — во вкладке стипендий"}
              </p>
            </Card>
            <Card className={s.summaryCard}>
              <p className={ui.caption}>Выплачено за доступный период</p>
              <p className={`${ui.largeNumber} ${s.summaryValue}`}>
                {money(paid)}
              </p>
              <p className={ui.caption}>
                Только выплаты со статусом «Выплачено»
              </p>
            </Card>
            <Card className={s.summaryCard}>
              <p className={ui.caption}>Форма финансирования</p>
              <p className={`${ui.largeNumber} ${s.summaryValue}`}>
                {student.funding}
              </p>
              <Link href="/finance?tab=contracts" className={ui.link}>
                Договоры и график →
              </Link>
            </Card>
          </div>
          <Card className={ui.stack}>
            <h2>Финансовые документы</h2>
            <div className={ui.row}>
              <Link className={ui.button} href="/services/scholarship-payments">
                Сведения о выплатах
                <ArrowUpRight size={15} />
              </Link>
              <Link className={ui.button} href="/services/support-grant">
                Материальная поддержка
                <ArrowUpRight size={15} />
              </Link>
              <Link className={ui.button} href="/finance?tab=scholarships">
                Стипендиальные кампании
                <ArrowUpRight size={15} />
              </Link>
            </div>
            <p className={ui.caption}>
              Справочные демонстрационные данные. Оплата и перевод денег в
              кабинете не выполняются.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
