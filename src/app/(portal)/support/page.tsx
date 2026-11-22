import Link from "next/link";
import { pageStudent } from "@/server/access";
import { PageTitle, Card, ui } from "@/shared/ui/primitives";
import { supportFaq } from "@/shared/config/support";
export default async function SupportPage() {
  await pageStudent();
  return (
    <>
      <PageTitle
        title="Поддержка"
        description="Поможем разобраться и найти следующий шаг."
        action={
          <Link
            className={`${ui.button} ${ui.primary}`}
            href="/services/support"
          >
            Написать в поддержку
          </Link>
        }
      />
      <div className={ui.grid2}>
        <Card>
          <h2>Частые вопросы</h2>
          {supportFaq.map(([id, question, answer]) => (
            <details id={`faq-${id}`} className={ui.listItem} key={id}>
              <summary>{question}</summary>
              <p className={ui.muted}>{answer}</p>
            </details>
          ))}
        </Card>
        <div className={ui.stack}>
          <Card>
            <h2>Учебный офис</h2>
            <p className={ui.muted}>
              Вопросы о программе, результатах, документах и учебных данных.
            </p>
            <p className={ui.caption}>
              Пн–Пт, 10:00–18:00 · корпус А, кабинет 101
            </p>
            <Link className={ui.link} href="/people?tab=departments">
              Контакты подразделений →
            </Link>
          </Card>
          <Card>
            <h2>Техническая проблема?</h2>
            <p className={ui.muted}>
              Опишите, что произошло и какого результата вы ожидали. При
              необходимости приложите демонстрационный PDF.
            </p>
            <Link className={ui.button} href="/services/support">
              Создать обращение
            </Link>
            <p className={ui.caption}>
              Сообщение сохраняется на сервере. Ответы не генерируются
              автоматически.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
