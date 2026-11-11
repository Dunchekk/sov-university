// Untrusted recurrence expansion lives outside the web event loop, with a deadline
// and a heap limit applied by the caller. Never fetch attachments or remote URLs.
import { parentPort, workerData } from "node:worker_threads";
import { createHash } from "node:crypto";
import ICAL from "ical.js";
import ical from "node-ical";
import { fromZonedTime } from "date-fns-tz";

const fail = (message) => {
  throw new Error(message);
};
const zoneExists = (zone) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};
const day = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const textValue = (value) =>
  typeof value === "string" ? value : (value?.val ?? "");

function parse({ original, timezone, from, to }) {
  const root = new ICAL.Component(ICAL.parse(original));
  if (
    root.name !== "vcalendar" ||
    root.getFirstPropertyValue("version") !== "2.0"
  )
    fail("Нужен файл VCALENDAR версии 2.0.");
  const components = root.getAllSubcomponents("vevent");
  if (components.length > 2000)
    fail("В файле больше 2000 базовых событий. Разделите файл.");
  const warnings = new Set();
  const invalid = new Set();
  const identities = new Set();
  let duplicates = 0;
  for (const other of root.getAllSubcomponents()) {
    if (!["vevent", "vtimezone"].includes(other.name))
      warnings.add(`${other.name.toUpperCase()}: неподдержанный тип пропущен.`);
  }
  for (const event of components) {
    const uid = event.getFirstPropertyValue("uid");
    const start = event.getFirstProperty("dtstart");
    if (typeof uid !== "string" || !uid.trim() || uid.length > 500 || !start) {
      invalid.add(uid);
      warnings.add("События без корректных UID / DTSTART пропущены.");
      continue;
    }
    const startValue = start.getFirstValue();
    const end = event.getFirstProperty("dtend");
    const duration = event.getFirstPropertyValue("duration");
    if (
      end &&
      (end.type !== start.type ||
        (start.type === "date" &&
          end.getFirstValue().toString() <= startValue.toString()))
    )
      fail(
        "Конец события должен быть позже начала для даты без времени. Проверьте файл.",
      );
    if (
      duration &&
      (duration.toSeconds() < 0 ||
        (start.type === "date" &&
          (duration.toSeconds() < 86400 || duration.toSeconds() % 86400 !== 0)))
    )
      fail("Конец события: некорректная длительность. Проверьте файл.");
    if (end && duration)
      fail(
        "Конец события задан одновременно DTEND и DURATION. Проверьте файл.",
      );
    const identity = `${uid}\0${event.getFirstPropertyValue("recurrence-id")?.toString() ?? "single"}`;
    if (identities.has(identity)) duplicates++;
    identities.add(identity);
    for (const name of ["rdate", "exrule"]) {
      if (event.hasProperty(name)) {
        invalid.add(uid);
        warnings.add(
          `${name.toUpperCase()}: серия пропущена; используйте RRULE и EXDATE.`,
        );
      }
    }
    if (event.getFirstProperty("recurrence-id")?.getParameter("range")) {
      invalid.add(uid);
      warnings.add("RECURRENCE-ID с RANGE не поддерживается; серия пропущена.");
    }
    for (const property of event.getAllProperties()) {
      if (
        !["dtstart", "dtend", "exdate", "recurrence-id"].includes(property.name)
      )
        continue;
      for (const value of property.getValues()) {
        const rawDay = value.toString().slice(0, 10);
        const date = new Date(`${rawDay}T00:00:00Z`);
        if (Number.isNaN(+date) || date.toISOString().slice(0, 10) !== rawDay)
          fail("Нужен файл с корректными календарными датами.");
      }
      const zone = property.getParameter("tzid");
      if (zone && !zoneExists(zone)) {
        invalid.add(uid);
        warnings.add(
          `Неизвестный TZID «${String(zone).slice(0, 80)}»: серия пропущена.`,
        );
        continue;
      }
      if (
        property.type === "date-time" &&
        !zone &&
        property.getValues().some((value) => value.zone?.tzid === "floating")
      ) {
        property.setParameter("tzid", timezone);
        warnings.add(`Время без зоны прочитано в ${timezone}.`);
      }
    }
    if (event.getAllSubcomponents("valarm").length)
      warnings.add("VALARM пропущены: напоминания не запускаются.");
    if (event.hasProperty("attach"))
      warnings.add("Вложения ATTACH не загружаются.");
    if (event.hasProperty("attendee") || event.hasProperty("organizer"))
      warnings.add("Участники не импортируются, приглашения не отправляются.");
  }
  for (const event of components)
    if (invalid.has(event.getFirstPropertyValue("uid")))
      root.removeSubcomponent(event);
  const parsed = ical.sync.parseICS(root.toString());
  const result = new Map();
  const rangeStart = fromZonedTime(`${from}T00:00:00`, timezone);
  const rangeEnd = fromZonedTime(`${to}T00:00:00`, timezone);
  for (const event of Object.values(parsed)) {
    if (event.type !== "VEVENT") continue;
    for (const candidate of [
      event,
      ...Object.values(event.recurrences ?? {}),
    ]) {
      if (candidate.start && candidate.end && candidate.end < candidate.start)
        fail("Конец события раньше начала. Проверьте файл.");
    }
    const allDay = event.datetype === "date";
    const instances = ical.expandRecurringEvent(event, {
      from: allDay ? new Date(`${from}T00:00:00`) : rangeStart,
      to: allDay ? new Date(`${to}T00:00:00`) : rangeEnd,
      excludeExdates: false,
      includeOverrides: true,
      expandOngoing: true,
      maxIterations: 10001,
    });
    for (const instance of instances) {
      const startDate = instance.isFullDay ? day(instance.start) : null;
      const endDate = instance.isFullDay ? day(instance.end) : null;
      if (
        startDate
          ? startDate >= to || endDate <= from
          : instance.start >= rangeEnd || instance.end < rangeStart
      )
        continue;
      const source = instance.event;
      const recurrenceKey = source.recurrenceid
        ? source.recurrenceid.dateOnly
          ? day(source.recurrenceid)
          : source.recurrenceid.toISOString()
        : event.rrule
          ? (startDate ?? instance.start.toISOString())
          : "single";
      const excluded =
        event.exdate &&
        (event.exdate[recurrenceKey] ||
          (event.exdate[recurrenceKey.slice(0, 10)]?.dateOnly &&
            event.exdate[recurrenceKey.slice(0, 10)]));
      let url = textValue(source.url || event.url);
      if (url && !/^https:\/\//i.test(url)) {
        warnings.add("Ссылки без HTTPS пропущены.");
        url = "";
      }
      const data = {
        uid: event.uid,
        recurrenceKey,
        title:
          textValue(source.summary || event.summary).slice(0, 300) ||
          "Без названия",
        description: textValue(source.description ?? event.description).slice(
          0,
          10000,
        ),
        location: textValue(source.location ?? event.location).slice(0, 500),
        url: url.slice(0, 2000) || null,
        startsAt: startDate ? null : instance.start.toISOString(),
        endsAt: startDate ? null : instance.end.toISOString(),
        startDate,
        endDate,
        timezone: source.start?.tz || event.start?.tz || timezone,
        cancelled: Boolean(
          excluded || textValue(source.status || event.status) === "CANCELLED",
        ),
      };
      if (!startDate && instance.end < instance.start)
        fail("Конец события раньше начала. Проверьте файл.");
      const contentHash = createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");
      result.set(`${data.uid}\0${recurrenceKey}`, { ...data, contentHash });
      if (result.size > 10000)
        fail("Больше 10000 вхождений. Выберите меньший диапазон.");
    }
  }
  return {
    events: [...result.values()],
    warnings: [...warnings],
    duplicates,
    baseEvents: components.length,
  };
}
try {
  parentPort.postMessage({ result: parse(workerData) });
} catch (error) {
  // Parser errors may contain private input. Return only our fixed messages.
  const known = [
    "Нужен файл",
    "В файле больше",
    "Больше 10000",
    "Конец события",
  ];
  const message = known.some((prefix) => error.message?.startsWith(prefix))
    ? error.message
    : "Не удалось разобрать файл или превышена сложность повторений. Проверьте ICS и уменьшите диапазон.";
  parentPort.postMessage({ error: message });
}
