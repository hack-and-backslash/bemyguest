import Link from "next/link";
import { eventsOn, mainDays, wedding } from "@/content/wedding";
import { Avatar } from "@/components/Avatar";
import { CalendarButtonRow, getCalendarLinks } from "@/components/CalendarButtons";
import { Illustration, Wave } from "@/components/Decor";
import { Icon } from "@/components/Icon";
import { StickyNote } from "@/components/StickyNote";
import { getConfirmedGuests, getRsvp, getViewer, listNotes } from "@/lib/data";
import { firstName, formatClock, formatDayNumber, formatMonthWeekday, formatWeekdayDate } from "@/lib/format";
import { dayLabels, mealLabels, plusOneLabel } from "@/lib/types";
import { cx, navItems, tintBg } from "@/lib/ui";

export default async function HomePage() {
  const viewer = (await getViewer())!;
  const [rsvp, confirmed, notes, calendar] = await Promise.all([
    getRsvp(viewer.guest.id),
    getConfirmedGuests(),
    listNotes(viewer.guest.id),
    getCalendarLinks("all"),
  ]);
  const first = firstName(viewer.guest.displayName);
  const done = rsvp.completed;
  const visibleNotes = notes.filter((n) => !n.hidden).slice(0, 2);
  const firstDay = wedding.days[0];
  const lastDay = wedding.days[wedding.days.length - 1];
  const checkIn = eventsOn(firstDay.id)[0];
  const lastEvents = eventsOn(lastDay.id);
  const checkout = lastEvents[lastEvents.length - 1];

  return (
    <>
      {/* Greeting */}
      <section className="relative grid grid-cols-[minmax(0,1fr)_118px] items-center gap-x-3 gap-y-4 px-5 pt-2 pb-8 sm:grid-cols-[minmax(0,1fr)_200px] lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-x-16 lg:px-24 lg:pt-6 lg:pb-4">
        <Illustration name="cloud" className="animate-drift pointer-events-none absolute top-2 left-[40%] hidden w-56 opacity-90 lg:block" />
        <Illustration name="doodle-birds" className="pointer-events-none absolute top-[380px] left-[48%] hidden w-28 opacity-80 lg:block" />

        <div className="animate-fade-up col-start-1 row-start-1 flex flex-col gap-1 lg:gap-3 lg:self-end">
          <p className="kicker text-[26px] text-coral-600 lg:text-[40px]">Hey {first},</p>
          <h1 className="font-serif text-[30px] leading-[1.1] text-balance lg:text-[64px] lg:leading-[1.08]">
            We&apos;re so glad you&apos;re here!
          </h1>
        </div>

        <div className="relative col-start-2 row-start-1 aspect-[520/560] w-full lg:row-span-2">
          <Illustration
            name="frond"
            className="animate-sway pointer-events-none absolute -top-8 left-[65%] hidden w-[220px] origin-bottom-left lg:block"
          />
          <Illustration
            name="couple"
            alt="Hand-drawn portrait of the couple, cheek to cheek, wearing marigold garlands"
            className="relative h-full w-full"
          />
          <p className="absolute bottom-8 -left-14 hidden -rotate-[4deg] rounded-full bg-sand-50 px-4 py-2 font-script text-xl shadow-[0_8px_20px_rgb(31_58_61/0.12)] lg:block">
            that&apos;s us!
          </p>
        </div>

        <div className="animate-fade-up col-span-2 flex flex-col gap-6 lg:col-span-1 lg:col-start-1 lg:row-start-2 lg:self-start">
          <p className="max-w-[560px] text-lg leading-relaxed text-pretty text-ink-soft lg:text-xl lg:leading-[1.6]">
            This is our little corner of the internet for two sunny days in Goa. The plan, your RSVP and a wall full of
            love from everyone who&apos;s coming — it&apos;s all right here.
          </p>
          <div className="flex flex-wrap gap-3">
            {done ? (
              <>
                <Link href="/schedule" className="btn btn-primary">
                  See the plan
                  <Icon name="arrow-right" size={20} strokeWidth={2} />
                </Link>
                <Link href="/profile" className="btn btn-outline">
                  My RSVP
                </Link>
              </>
            ) : (
              <>
                <Link href="/rsvp" className="btn btn-primary">
                  RSVP in a minute
                  <Icon name="arrow-right" size={20} strokeWidth={2} />
                </Link>
                <Link href="/schedule" className="btn btn-outline">
                  See the plan
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Save the date */}
      <Wave fill="#CDEFE4" className="-mb-px" />
      <section
        id="save-the-date"
        aria-labelledby="save-title"
        className="flex flex-col gap-8 bg-sea-200 px-5 pt-4 pb-12 lg:flex-row lg:items-center lg:gap-16 lg:px-24 lg:pt-6 lg:pb-14"
      >
        <div className="flex flex-col gap-3 lg:w-[440px] lg:shrink-0">
          <p className="kicker text-[26px] text-coral-800 lg:text-[32px]">Save the date</p>
          <h2 id="save-title" className="font-serif text-[32px] leading-[1.15] text-balance lg:text-[42px]">
            Circle it, star it, set three alarms.
          </h2>
          <p className="flex items-center gap-2 text-lg">
            <Icon name="pin" size={20} />
            {wedding.venue} · {wedding.place}
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
            {mainDays.map((day) => {
              const events = eventsOn(day.id).filter((e) => e.highlight);
              return (
                <div
                  key={day.id}
                  className="flex items-center gap-5 rounded-3xl border-2 border-dashed border-sea-400 bg-sand-50 px-6 py-5"
                >
                  <div className="flex min-w-[88px] shrink-0 flex-col items-center">
                    <span className="overline text-sea-700">{day.label}</span>
                    <span className="font-serif text-[48px] leading-[1.05] lg:text-[52px]">{formatDayNumber(day.date)}</span>
                    <span className="text-sm text-ink-soft">{formatMonthWeekday(day.date)}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 border-l-2 border-dotted border-sea-400 pl-5">
                    <span className="flex gap-1.5">
                      {events.map((e) => (
                        <span key={e.id} className={cx("flex size-10 items-center justify-center rounded-full", tintBg[e.tint])}>
                          <Icon name={e.icon} />
                        </span>
                      ))}
                    </span>
                    <span className="font-serif text-xl leading-tight">{day.summary}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="flex items-start gap-2 text-[15px] text-ink">
            <Icon name="key" size={20} className="mt-0.5 shrink-0" />
            <span>
              Check-in from {formatClock(checkIn.startsAt)} on {formatWeekdayDate(firstDay.date)} · checkout by{" "}
              {formatClock(checkout.startsAt)} on {formatWeekdayDate(lastDay.date)}.{" "}
              <Link href="/schedule" className="font-semibold">
                See the full plan
              </Link>
            </span>
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <span className="text-[15px] font-semibold">Add the weekend to your calendar</span>
            <CalendarButtonRow links={calendar} />
          </div>
        </div>
      </section>

      {/* Where to next */}
      <section aria-labelledby="next-title" className="relative flex flex-col gap-6 px-4 pt-12 pb-12 lg:gap-9 lg:px-24 lg:pt-20 lg:pb-16">
        <Illustration name="doodle-shell" className="pointer-events-none absolute top-14 right-28 hidden w-20 rotate-[14deg] opacity-80 lg:block" />
        <div className="flex flex-col gap-1 px-1">
          <p className="kicker text-[24px] text-sea-700 lg:text-[30px]">Where to next?</p>
          <h2 id="next-title" className="font-serif text-[28px] leading-[1.15] lg:text-[44px]">
            Everything you need, one tap away.
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2.5 lg:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="tile flex h-24 flex-col items-center justify-center gap-1.5 rounded-[20px] bg-sand-50 text-center text-sm font-semibold text-ink no-underline shadow-[var(--shadow-rest)] hover:text-ink lg:h-[140px] lg:flex-row lg:justify-start lg:gap-5 lg:rounded-[28px] lg:p-6 lg:text-left"
            >
              <span
                className={cx(
                  "tile-icon flex size-12 shrink-0 items-center justify-center rounded-full lg:size-[88px]",
                  tintBg[item.tint],
                )}
              >
                <Icon name={item.icon} size={24} className="lg:hidden" />
                <Icon name={item.icon} size={40} strokeWidth={1.5} className="hidden lg:block" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="lg:font-serif lg:text-2xl lg:font-normal">{item.label}</span>
                <span className="hidden text-base leading-snug font-normal text-ink-soft lg:block">{item.blurb}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* RSVP status + who's coming */}
      <section className="grid gap-6 px-4 pb-16 lg:grid-cols-2 lg:gap-8 lg:px-24 lg:pb-20">
        {done ? (
          <div className="relative flex flex-col gap-3 overflow-hidden rounded-[32px] bg-sea-200 p-8 lg:p-10">
            <Illustration name="boat" className="animate-bob pointer-events-none absolute -right-10 -bottom-1 w-[240px] lg:w-[300px]" />
            <p className="kicker text-2xl text-sea-800">You&apos;re all set!</p>
            <h2 className="relative max-w-sm font-serif text-[30px] leading-tight lg:text-[34px]">
              {rsvp.attending === "yes" ? "We've got your RSVP" : "Thanks for letting us know"}
            </h2>
            {rsvp.attending === "yes" && (
              <div className="relative flex max-w-[360px] flex-wrap gap-2">
                {rsvp.days && <span className="rounded-full bg-sand-50 px-3.5 py-1.5 text-[15px] font-semibold">{dayLabels[rsvp.days]}</span>}
                <span className="rounded-full bg-sand-50 px-3.5 py-1.5 text-[15px] font-semibold">
                  {plusOneLabel(rsvp)}
                </span>
                {rsvp.meal && (
                  <span className="rounded-full bg-sand-50 px-3.5 py-1.5 text-[15px] font-semibold">{mealLabels[rsvp.meal]}</span>
                )}
              </div>
            )}
            <Link href="/profile" className="btn btn-sea relative mt-3 self-start">
              See my details
            </Link>
          </div>
        ) : (
          <div className="relative flex flex-col gap-3 overflow-hidden rounded-[32px] bg-coral-200 p-8 lg:p-10">
            <Illustration name="boat" className="animate-bob pointer-events-none absolute -right-10 -bottom-1 w-[240px] lg:w-[300px]" />
            <p className="kicker text-2xl text-coral-800">Psst…</p>
            <h2 className="relative max-w-sm font-serif text-[30px] leading-tight lg:text-[34px]">We still need your RSVP</h2>
            <p className="relative max-w-[340px] text-lg leading-relaxed">
              A few quick questions, no essays. You can change your answers anytime.
            </p>
            <Link href="/rsvp" className="btn btn-primary relative mt-3 self-start">
              Let&apos;s do it
              <Icon name="arrow-right" size={20} strokeWidth={2} />
            </Link>
          </div>
        )}

        <div className="card flex flex-col gap-4 rounded-[32px] p-8 lg:px-10 lg:py-9">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-[28px] lg:text-[30px]">Who&apos;s coming</h2>
            <span className="text-[15px] font-semibold text-sea-700">
              {confirmed.length === 1 ? "1 guest said yes" : `${confirmed.length} guests said yes`}
            </span>
          </div>
          {confirmed.length > 0 ? (
            <div className="flex items-center">
              {confirmed.slice(0, 5).map((g, i) => (
                <Avatar
                  key={`${g.displayName}-${i}`}
                  name={g.displayName}
                  url={g.avatarUrl}
                  size={52}
                  className={cx("border-[3px] border-sand-50", i > 0 && "-ml-3")}
                />
              ))}
              {confirmed.length > 5 && (
                <span className="-ml-3 flex size-[52px] items-center justify-center rounded-full border-[3px] border-sand-50 bg-ink text-sm font-bold text-white">
                  +{confirmed.length - 5}
                </span>
              )}
            </div>
          ) : (
            <p className="text-ink-soft">Nobody yet — you could be first!</p>
          )}
          {visibleNotes.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {visibleNotes.map((n, i) => (
                <StickyNote key={n.id} note={n} index={i} size="sm" />
              ))}
            </div>
          )}
          <Link href="/wall" className="flex items-center gap-1.5 self-start font-semibold">
            Visit the guest wall
            <Icon name="arrow-right" size={18} strokeWidth={2} />
          </Link>
        </div>
      </section>
    </>
  );
}
