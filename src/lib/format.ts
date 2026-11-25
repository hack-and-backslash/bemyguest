import { wedding, type WeddingEvent } from "@/content/wedding";

const tz = wedding.timeZone;

/** "2027-02-12" → a Date at noon IST, so the calendar day never shifts. */
function dayToDate(day: string) {
  return new Date(`${day}T12:00:00+05:30`);
}

export function formatDayShort(day: string | null) {
  if (!day) return "[DD Mon]";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: tz }).format(dayToDate(day));
}

export function formatDayNumber(day: string | null) {
  if (!day) return "[DD]";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: tz }).format(dayToDate(day));
}

export function formatMonthWeekday(day: string | null) {
  if (!day) return "[Mon] · [Day]";
  const d = dayToDate(day);
  const month = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: tz }).format(d);
  const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: tz }).format(d);
  return `${month} · ${weekday}`;
}

/** "Sat, 30 Jan" */
export function formatWeekdayDate(day: string | null) {
  if (!day) return "[Day], [DD Mon]";
  const d = dayToDate(day);
  const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: tz }).format(d);
  return `${weekday}, ${formatDayShort(day)}`;
}

export function formatDayLong(day: string | null) {
  if (!day) return "[Weekday], [DD Month]";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  }).format(dayToDate(day));
}

export function formatTime(iso: string | null) {
  if (!iso) return "[Time]";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz })
    .format(new Date(iso))
    .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
}

/** "2 PM", "8:30 PM" — drops ":00" like the printed plan. */
export function formatClock(iso: string | number) {
  return formatTime(new Date(iso).toISOString()).replace(":00 ", " ");
}

export function formatTimeRange(start: string | null, end: string | null) {
  if (!start) return "[Start] – [End]";
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

/** Matches the event plan: "2 PM", "2 PM – 4 PM", "Till 10 AM". */
export function formatEventTime(e: Pick<WeddingEvent, "startsAt" | "endsAt" | "untilOnly">) {
  if (e.untilOnly && e.endsAt) return `Till ${formatClock(e.endsAt)}`;
  if (!e.endsAt) return formatClock(e.startsAt);
  return `${formatClock(e.startsAt)} – ${formatClock(e.endsAt)}`;
}

/** "30 Jan – 31 Jan" for headers (the two main days). */
export function formatDateSpan() {
  const [d1, d2] = wedding.days;
  if (!d1.date || !d2.date) return "[Day 1 date] – [Day 2 date]";
  return `${formatDayShort(d1.date)} – ${formatDayShort(d2.date)}`;
}

/** "15 January" for an RSVP deadline ("YYYY-MM-DD"). */
export function formatDeadline(day: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: tz }).format(dayToDate(day));
}

export function firstName(name: string | null | undefined) {
  const n = (name ?? "").trim();
  return n ? n.split(/\s+/)[0] : "friend";
}

/** "Sun 31 Jan · 5:32 PM" (IST), for photos. */
export function formatStamp(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: tz })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.weekday} ${parts.day} ${parts.month} · ${formatTime(d.toISOString())}`;
}
