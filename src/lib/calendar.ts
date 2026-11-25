import { coupleNames, eventsOn, locationOf, wedding, type WeddingEvent } from "@/content/wedding";
import { formatClock, formatWeekdayDate } from "@/lib/format";

/** "all" = the whole weekend; otherwise an event id from content/wedding.ts. */
export type CalendarTarget = "all" | string;

type CalEntry = {
  uid: string;
  title: string;
  location: string;
  description: string;
  /** Timed events: ISO strings. All-day: YYYY-MM-DD (end is exclusive). */
  start: string;
  end: string;
  allDay: boolean;
};

const DEFAULT_HOURS = 2;

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Only events with a real start time can go in a calendar ("Till 10 AM" can't). */
export function canAddToCalendar(ev: WeddingEvent) {
  return !ev.untilOnly;
}

function eventEntry(ev: WeddingEvent, siteUrl: string): CalEntry | null {
  if (!canAddToCalendar(ev)) return null;
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : new Date(start.getTime() + DEFAULT_HOURS * 3600_000);
  return {
    uid: `${ev.id}@bemyguest`,
    title: `${ev.title} · ${coupleNames}`,
    location: locationOf(ev),
    description: `${ev.blurb}\n\n${siteUrl}/schedule`,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
  };
}

function spanEntry(siteUrl: string): CalEntry {
  const first = wedding.days[0];
  const last = wedding.days[wedding.days.length - 1];
  const checkIn = eventsOn(first.id)[0];
  const lastEvents = eventsOn(last.id);
  const checkout = lastEvents[lastEvents.length - 1];
  const lines = [
    `Check-in from ${formatClock(checkIn.startsAt)} on ${formatWeekdayDate(first.date)}.`,
    ...wedding.days.filter((d) => !d.extra).map((d) => `${d.label}: ${d.summary}.`),
    `Checkout by ${formatClock(checkout.startsAt)} on ${formatWeekdayDate(last.date)}.`,
  ];
  return {
    uid: `weekend@bemyguest`,
    title: `${coupleNames}'s wedding · Goa`,
    location: locationOf(),
    description: `${lines.join("\n")}\n\n${siteUrl}`,
    start: first.date,
    end: addDays(last.date, 1),
    allDay: true,
  };
}

/** Whole weekend: one all-day block plus the big moments. One event: just that event. */
export function calendarEntries(target: CalendarTarget, siteUrl: string): CalEntry[] {
  if (target === "all") {
    const highlights = wedding.events
      .filter((e) => e.highlight)
      .map((e) => eventEntry(e, siteUrl))
      .filter((e): e is CalEntry => e !== null);
    return [spanEntry(siteUrl), ...highlights];
  }
  const ev = wedding.events.find((e) => e.id === target);
  const entry = ev ? eventEntry(ev, siteUrl) : null;
  return entry ? [entry] : [];
}

export function isCalendarReady(target: CalendarTarget) {
  return calendarEntries(target, "").length > 0;
}

function compactUtc(iso: string) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Single-event links (Google/Outlook can't take several events at once). */
function linkEntry(target: CalendarTarget, siteUrl: string): CalEntry | null {
  return calendarEntries(target, siteUrl)[0] ?? null;
}

export function googleCalendarUrl(target: CalendarTarget, siteUrl: string) {
  const e = linkEntry(target, siteUrl);
  if (!e) return null;
  const dates = e.allDay
    ? `${e.start.replace(/-/g, "")}/${e.end.replace(/-/g, "")}`
    : `${compactUtc(e.start)}/${compactUtc(e.end)}`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, details: e.description, location: e.location });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function outlookCalendarUrl(target: CalendarTarget, siteUrl: string) {
  const e = linkEntry(target, siteUrl);
  if (!e) return null;
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: e.start,
    enddt: e.end,
    body: e.description,
    location: e.location,
  });
  if (e.allDay) p.set("allday", "true");
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}

function escapeIcs(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Fold lines to 75 octets as RFC 5545 asks. */
function fold(line: string) {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74;
    if (enc.encode(current + ch).length > limit) {
      out.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(target: CalendarTarget, siteUrl: string) {
  const entries = calendarEntries(target, siteUrl);
  const stamp = compactUtc(new Date().toISOString());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//bemyguest//RSVP site//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of entries) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${e.start.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${e.end.replace(/-/g, "")}`);
    } else {
      lines.push(`DTSTART:${compactUtc(e.start)}`, `DTEND:${compactUtc(e.end)}`);
    }
    lines.push(
      `SUMMARY:${escapeIcs(e.title)}`,
      `LOCATION:${escapeIcs(e.location)}`,
      `DESCRIPTION:${escapeIcs(e.description)}`,
      `URL:${siteUrl}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
