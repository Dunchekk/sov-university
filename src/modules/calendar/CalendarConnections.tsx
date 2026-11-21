import { ArrowUpRight } from "lucide-react";
import { integrations } from "./integrations";
import { Integrations } from "./CalendarIntegrations";
import { Card, ui } from "@/shared/ui/primitives";
import { dateKey } from "@/shared/lib/time";
import s from "./calendar.module.css";

export async function CalendarConnections({
  studentId,
}: {
  studentId: string;
}) {
  const data = await integrations(studentId);
  return (
    <div className={ui.stack}>
      <Integrations
        today={dateKey()}
        sources={data.sources.map((s) => ({
          id: s.id,
          name: s.name,
          count: s._count.events,
        }))}
        feeds={data.feeds.map((f) => ({
          ...f,
          createdAt: f.createdAt.toISOString(),
        }))}
        publicAddress={process.env.APP_URL?.startsWith("https://") ?? false}
      />
      <details className={ui.details}>
        <summary>Как подключить другой календарь</summary>
        <div className={ui.grid2}>
          {[
            {
              name: "Google Календарь",
              file: "На компьютере откройте настройки → «Импорт и экспорт», выберите скачанный ICS и календарь назначения.",
              feed: "В разделе «Другие календари» нажмите «+» → «Добавить по URL» и вставьте приватную HTTPS-ссылку.",
              links: [
                [
                  "Импорт",
                  "https://support.google.com/calendar/answer/37118?hl=ru",
                ],
                [
                  "Подписка",
                  "https://support.google.com/calendar/answer/37100?hl=ru",
                ],
              ],
            },
            {
              name: "Apple Calendar",
              file: "Откройте скачанный ICS в приложении «Календарь» и выберите календарь для копии событий.",
              feed: "На Mac: «Файл» → «Новая подписка на календарь». Вставьте HTTPS-ссылку или используйте webcal-ссылку после её создания.",
              links: [
                ["Подписки Apple", "https://support.apple.com/ru-ru/102301"],
              ],
            },
            {
              name: "Яндекс Календарь",
              file: "На сайте календаря откройте «Новый календарь» → «Импорт» → «Из файла» и выберите ICS.",
              feed: "В текущей справке Яндекса импорт «По ссылке» тоже описан как разовая копия. Повторяйте импорт для обновления или используйте ICS-подписку в Google, Apple либо Outlook.",
              links: [
                [
                  "Инструкция Яндекса",
                  "https://yandex.ru/support/yandex-360/customers/calendar/app/ru/import",
                ],
              ],
            },
            {
              name: "Outlook",
              file: "«Добавить календарь» → «Загрузить из файла»: выберите ICS и календарь назначения.",
              feed: "«Добавить календарь» → «Подписаться из Интернета» (Subscribe from web). Вставьте HTTPS-ссылку и сохраните.",
              links: [
                [
                  "Импорт и подписка",
                  "https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web",
                ],
              ],
            },
          ].map((provider) => (
            <Card key={provider.name}>
              <div className={ui.stack}>
                <h3>{provider.name}</h3>
                <p>
                  <strong>Разовая копия.</strong> {provider.file}
                </p>
                <p>
                  <strong>С обновлениями.</strong> {provider.feed}
                </p>
                <div className={ui.row}>
                  {provider.links.map(([label, href]) => (
                    <a
                      className={`${ui.link} ${s.providerLink}`}
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {label} <ArrowUpRight size={15} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </details>
      <p className={ui.caption}>
        Подписка односторонняя: изменения во внешнем календаре не меняют
        расписание в «Рядом». Это демонстрационный кабинет без подключения к
        университетским системам.
      </p>
    </div>
  );
}
