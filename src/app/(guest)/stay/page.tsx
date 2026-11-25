import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { eventsOn, wedding, type IconName } from "@/content/wedding";
import { stay } from "@/content/venue";
import { Illustration, Wave } from "@/components/Decor";
import { Icon } from "@/components/Icon";
import { formatClock, formatWeekdayDate } from "@/lib/format";
import { cx, tintBg } from "@/lib/ui";
import { PackingList } from "./PackingList";
import cottagesPhoto from "./stone-water-cottages.webp";

export const metadata: Metadata = { title: "Stay" };

function Fact({ icon, label, value, note }: { icon: IconName; label: string; value: string; note?: string }) {
  return (
    <div className="flex gap-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sea-200">
        <Icon name={icon} size={22} />
      </span>
      <div className="flex flex-col gap-0.5">
        <dt className="overline text-sea-700">{label}</dt>
        <dd className="text-lg leading-snug font-semibold">{value}</dd>
        {note && <dd className="text-[15px] leading-snug text-ink-soft">{note}</dd>}
      </div>
    </div>
  );
}

export default function StayPage() {
  const first = wedding.days[0];
  const last = wedding.days[wedding.days.length - 1];
  const checkIn = eventsOn(first.id)[0];
  const lunch = eventsOn(first.id).find((e) => e.meal);
  const lastEvents = eventsOn(last.id);
  const checkout = lastEvents[lastEvents.length - 1];
  const breakfast = lastEvents.find((e) => e.meal);
  const nights = Math.round((Date.parse(last.date) - Date.parse(first.date)) / 86_400_000);

  return (
    <>
      <section className="relative flex flex-col gap-2 px-5 pt-4 pb-8 lg:gap-2.5 lg:px-28 lg:pt-10 lg:pb-10">
        <Illustration name="doodle-birds" className="pointer-events-none absolute top-12 right-36 hidden w-32 opacity-80 lg:block" />
        <div className="flex flex-wrap items-center gap-3">
          <p className="kicker text-[26px] text-sea-700 lg:text-[32px]">{stay.kicker}</p>
          <span className="rounded-full bg-sun-100 px-3 py-1 text-sm font-bold">{nights} nights, on us</span>
        </div>
        <h1 className="max-w-[860px] font-serif text-[34px] leading-[1.1] text-balance lg:text-[56px]">{stay.title}</h1>
        <p className="max-w-[760px] text-lg text-pretty text-ink-soft lg:text-[19px] lg:leading-relaxed">{stay.intro}</p>
      </section>

      {/* Real photo + the weekend at a glance */}
      <section className="grid gap-8 px-4 pb-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-14 lg:px-24 lg:pb-20">
        <figure className="relative mx-2 -rotate-[1.5deg] rounded-[18px] bg-white p-3 pb-2 shadow-[0_18px_40px_rgb(31_58_61/0.16)] lg:mx-0 lg:p-4 lg:pb-3">
          <span
            aria-hidden="true"
            className="absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 rotate-[3deg] rounded-sm bg-sun-300/70"
          />
          <Image
            src={cottagesPhoto}
            alt="Wooden cottages with clay-tile roofs on a grassy slope, among big trees and flowering shrubs"
            placeholder="blur"
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="aspect-[16/10] w-full rounded-[10px] object-cover"
          />
          <figcaption className="px-1 pt-2 font-script text-xl text-ink-soft">The cottages, for real</figcaption>
        </figure>

        <div className="card flex flex-col gap-6 rounded-[32px] p-7 lg:p-9">
          <h2 className="font-serif text-[28px] leading-tight lg:text-[32px]">The weekend at a glance</h2>
          <dl className="flex flex-col gap-5">
            <Fact
              icon="key"
              label="Check-in"
              value={`From ${formatClock(checkIn.startsAt)} on ${formatWeekdayDate(first.date)}`}
              note={lunch ? `Lunch is on till ${formatClock(lunch.endsAt ?? lunch.startsAt)}, so come hungry.` : undefined}
            />
            <Fact
              icon="suitcase"
              label="Checkout"
              value={`By ${formatClock(checkout.startsAt)} on ${formatWeekdayDate(last.date)}`}
              note={breakfast?.endsAt ? `After one last breakfast (till ${formatClock(breakfast.endsAt)}).` : undefined}
            />
            <Fact icon="pin" label="Where" value={wedding.venue} note={wedding.address} />
          </dl>
          <div className="flex flex-wrap gap-3">
            <a href={wedding.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-sea">
              <Icon name="pin" size={18} strokeWidth={2} />
              Open in Maps
            </a>
            <Link href="/travel" className="btn btn-sm btn-outline">
              How to get here
              <Icon name="arrow-right" size={18} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>

      {/* Your cottage */}
      <Wave fill="#FFF1C2" className="-mb-px" />
      <section
        aria-labelledby="cottage-title"
        className="grid gap-8 bg-sun-100 px-5 pt-4 pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:px-24 lg:pb-16"
      >
        <div className="flex flex-col gap-3">
          <p className="kicker text-[26px] text-coral-800 lg:text-[32px]">{stay.cottage.title}</p>
          <h2 id="cottage-title" className="font-serif text-[30px] leading-[1.15] text-balance lg:text-[42px]">
            A wooden chalet under the trees.
          </h2>
          <p className="max-w-[520px] text-lg leading-relaxed text-pretty">{stay.cottage.body}</p>
          <Illustration name="cottage" className="mt-2 hidden w-[340px] self-start lg:block" />
        </div>
        <div className="relative flex flex-col gap-4 rounded-[28px] bg-sand-50 p-7 shadow-[var(--shadow-rest)] lg:p-9">
          <span className="overline text-sea-700">What&apos;s in your room</span>
          <ul className="flex flex-col gap-3">
            {stay.cottage.amenities.map((a) => (
              <li key={a} className="flex items-start gap-3 text-lg leading-snug">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-palm-100 text-palm-700">
                  <Icon name="check" size={16} strokeWidth={2.5} />
                </span>
                {a}
              </li>
            ))}
          </ul>
          <Illustration name="cottage" className="-mb-2 w-[220px] self-end lg:hidden" />
        </div>
      </section>

      {/* Around the resort */}
      <section aria-labelledby="grounds-title" className="relative flex flex-col gap-6 px-4 pt-14 pb-14 lg:gap-9 lg:px-24 lg:pt-20 lg:pb-16">
        <Illustration name="doodle-shell" className="pointer-events-none absolute top-16 right-28 hidden w-20 rotate-[14deg] opacity-80 lg:block" />
        <div className="flex flex-col gap-1 px-1">
          <p className="kicker text-[24px] text-sea-700 lg:text-[30px]">Around the resort</p>
          <h2 id="grounds-title" className="font-serif text-[28px] leading-[1.15] lg:text-[44px]">
            Twenty acres to wander.
          </h2>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {stay.grounds.map((g) => (
            <li key={g.title} className="tile card flex flex-col gap-3 rounded-[28px] p-6 lg:p-7">
              <span className={cx("tile-icon flex size-14 items-center justify-center rounded-full", tintBg[g.tint])}>
                <Icon name={g.icon} size={26} />
              </span>
              <h3 className="font-serif text-[22px] leading-tight lg:text-2xl">{g.title}</h3>
              <p className="text-[16px] leading-relaxed text-ink-soft">{g.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Good to know + packing */}
      <section className="grid gap-6 px-4 pb-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:px-24 lg:pb-16">
        <section aria-labelledby="know-title" className="card flex flex-col gap-2 rounded-[32px] p-7 lg:p-9">
          <h2 id="know-title" className="mb-2 font-serif text-[28px] leading-tight lg:text-[30px]">
            Good to know
          </h2>
          <ul className="flex flex-col divide-y-2 divide-dotted divide-sand-300">
            {stay.goodToKnow.map((g) => (
              <li key={g.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-full", tintBg[g.tint])}>
                  <Icon name={g.icon} size={21} />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-bold">{g.title}</h3>
                  <p className="leading-relaxed text-ink-soft">{g.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <PackingList items={stay.packing} />
      </section>

      {/* Checkout morning */}
      <section className="px-4 pb-16 lg:px-24 lg:pb-20">
        <div className="relative flex flex-col gap-3 overflow-hidden rounded-[32px] bg-coral-200 p-8 pb-28 sm:pb-8 lg:p-10">
          <Illustration name="boat" className="animate-bob pointer-events-none absolute -right-10 -bottom-1 w-[220px] lg:w-[300px]" />
          <p className="kicker text-2xl text-coral-800">{formatWeekdayDate(last.date)}</p>
          <h2 className="relative max-w-xl font-serif text-[30px] leading-tight text-balance lg:text-[36px]">
            {breakfast?.endsAt ? `Breakfast till ${formatClock(breakfast.endsAt)}, ` : ""}checkout by {formatClock(checkout.startsAt)}.
          </h2>
          <p className="relative max-w-[520px] text-lg leading-relaxed">
            Flying out the same day? Our Getting there page has the flight times that work.
          </p>
          <Link href="/travel#heading-home" className="btn btn-primary relative mt-2 self-start">
            Plan the trip home
            <Icon name="arrow-right" size={20} strokeWidth={2} />
          </Link>
        </div>
      </section>
    </>
  );
}
