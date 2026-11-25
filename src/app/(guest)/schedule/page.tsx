import type { Metadata } from "next";
import { eventsOn, venueOf, wedding } from "@/content/wedding";
import { getCalendarLinks } from "@/components/CalendarButtons";
import { Illustration } from "@/components/Decor";
import { canAddToCalendar } from "@/lib/calendar";
import { getClock } from "@/lib/clock";
import { getViewer } from "@/lib/data";
import { formatEventTime, formatWeekdayDate } from "@/lib/format";
import { HOUR, IST_OFFSET_MS } from "@/lib/sky";
import { EventPicker, type TLDay } from "./EventPicker";

export const metadata: Metadata = { title: "Schedule" };

// Round to whole hours in IST (India is UTC+5:30, so UTC hours would land on :30).
const floorHour = (ms: number) => Math.floor((ms + IST_OFFSET_MS) / HOUR) * HOUR - IST_OFFSET_MS;
const ceilHour = (ms: number) => Math.ceil((ms + IST_OFFSET_MS) / HOUR) * HOUR - IST_OFFSET_MS;

function countdown(now: number): string | null {
  const start = Date.parse(`${wedding.days[0].date}T00:00:00+05:30`);
  const end = Date.parse(`${wedding.days[wedding.days.length - 1].date}T12:00:00+05:30`);
  if (now < start) {
    const n = Math.ceil((start - now) / (24 * HOUR));
    return n <= 1 ? "Tomorrow!" : `${n} sleeps to go`;
  }
  return now <= end ? "It's happening!" : null;
}

export default async function SchedulePage() {
  const clock = await getClock(await getViewer());
  const days: TLDay[] = await Promise.all(
    wedding.days.map(async (d) => {
      const events = await Promise.all(
        eventsOn(d.id).map(async (e) => ({
          id: e.id,
          day: e.day,
          title: e.title,
          icon: e.icon,
          tint: e.tint,
          start: Date.parse(e.startsAt),
          end: e.endsAt ? Date.parse(e.endsAt) : null,
          timeLabel: formatEventTime(e),
          venue: venueOf(e),
          mapsUrl: e.mapsUrl ?? null,
          blurb: e.blurb,
          meal: !!e.meal,
          highlight: !!e.highlight,
          calendar: canAddToCalendar(e) && (e.highlight || !e.meal) ? await getCalendarLinks(e.id) : null,
        })),
      );
      const first = Math.min(...events.map((e) => e.start));
      const last = Math.max(...events.map((e) => e.end ?? e.start + 1.5 * HOUR));
      return {
        id: d.id,
        label: d.label,
        dateLabel: formatWeekdayDate(d.date),
        summary: d.summary,
        extra: !!d.extra,
        axisStart: floorHour(first - HOUR / 2),
        axisEnd: ceilHour(last + HOUR / 2),
        events,
      };
    }),
  );
  const chip = countdown(clock.now);

  return (
    <>
      <section className="relative flex flex-col gap-2 px-5 pt-4 pb-6 lg:gap-2.5 lg:px-28 lg:pt-10 lg:pb-8">
        <Illustration name="doodle-birds" className="pointer-events-none absolute top-12 right-36 hidden w-32 opacity-80 lg:block" />
        <div className="flex flex-wrap items-center gap-3">
          <p className="kicker text-[26px] text-sky-700 lg:text-[32px]">The game plan</p>
          {chip && (
            <span className="rounded-full bg-coral-200 px-3 py-1 text-sm font-bold text-coral-800">{chip}</span>
          )}
        </div>
        <h1 className="max-w-[820px] font-serif text-[34px] leading-[1.1] text-balance lg:text-[56px]">
          Two days of sun, vows and very good food.
        </h1>
        <p className="max-w-[720px] text-lg text-pretty text-ink-soft lg:text-[19px]">
          Pick a day and watch it play out — the sky keeps time with the plan. Tap any moment for the details.
        </p>
      </section>
      <EventPicker days={days} sun={wedding.sun} previewAt={clock.preview ? clock.now : null} />
    </>
  );
}
