import { MapPin } from "lucide-react";
import type { CalendarEvent } from "./types";
import s from "./calendar.module.css";

export function EventTitle({ event }: { event: CalendarEvent }) {
  return (
    <span className={s.eventTitle}>
      <strong>{event.title}</strong>
      <EventLocation event={event} />
    </span>
  );
}

export function EventLocation({ event }: { event: CalendarEvent }) {
  if (!event.location) return null;
  return (
    <span className={s.eventLocation} title={event.location}>
      <MapPin size={11} aria-hidden />
      <span>{event.room ?? event.location}</span>
    </span>
  );
}
