import type { Metadata } from "next";
import Link from "next/link";
import { eventsOn, wedding, type IconName } from "@/content/wedding";
import { travel } from "@/content/venue";
import { CopyButton } from "@/components/CopyButton";
import { Illustration } from "@/components/Decor";
import { Icon } from "@/components/Icon";
import { getRsvp, getViewer } from "@/lib/data";
import { getControls } from "@/lib/controls";
import { formatClock, formatWeekdayDate } from "@/lib/format";
import { pointLabels, travelLabels, type TravelMode } from "@/lib/types";
import { cx } from "@/lib/ui";
import { TravelMap } from "./TravelMap";

export const metadata: Metadata = { title: "Getting there" };

const modeIcon: Record<TravelMode, IconName> = { flight: "plane", train: "train", road: "car" };

export default async function TravelPage() {
  const viewer = (await getViewer())!;
  const [rsvp, { contact }] = await Promise.all([getRsvp(viewer.guest.id), getControls()]);

  const first = wedding.days[0];
  const last = wedding.days[wedding.days.length - 1];
  const checkIn = eventsOn(first.id)[0];
  const lunch = eventsOn(first.id).find((e) => e.meal);
  const lastEvents = eventsOn(last.id);
  const checkout = lastEvents[lastEvents.length - 1];

  const arrivalDay = rsvp.arrivalDate
    ? new Date(`${rsvp.arrivalDate}T12:00:00+05:30`).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: wedding.timeZone,
      })
    : null;
  const arrivalBits = [
    arrivalDay && `Arriving ${arrivalDay}`,
    rsvp.arrivalSlot && (rsvp.arrivalSlot === "late" ? "late at night" : `in the ${rsvp.arrivalSlot}`),
    rsvp.arrivalPoint
      ? `${rsvp.travelMode === "train" ? "at" : "into"} ${pointLabels[rsvp.arrivalPoint]}`
      : rsvp.travelMode && `by ${travelLabels[rsvp.travelMode].toLowerCase()}`,
  ].filter(Boolean);
  const hasArrival = arrivalBits.length > 0;
  const notComing = rsvp.completed && rsvp.attending === "no";
  const tel = wedding.venuePhone.replace(/[^\d+]/g, "");

  return (
    <>
      <section className="relative flex flex-col gap-2 px-5 pt-4 pb-8 lg:gap-2.5 lg:px-28 lg:pt-10 lg:pb-10">
        <Illustration name="doodle-birds" className="pointer-events-none absolute top-12 right-36 hidden w-32 opacity-80 lg:block" />
        <p className="kicker text-[26px] text-sea-700 lg:text-[32px]">{travel.kicker}</p>
        <h1 className="max-w-[860px] font-serif text-[34px] leading-[1.1] text-balance lg:text-[56px]">{travel.title}</h1>
        <p className="max-w-[720px] text-lg text-pretty text-ink-soft lg:text-[19px] lg:leading-relaxed">{travel.intro}</p>
      </section>

      {/* This guest's arrival, from their RSVP */}
      {!notComing && (
        <section className="px-4 pb-10 lg:px-24 lg:pb-12">
          <div className="flex flex-col gap-4 rounded-[28px] border-2 border-dashed border-sea-400 bg-sand-50 p-6 sm:flex-row sm:items-center lg:px-8">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-sea-200">
              <Icon name={rsvp.travelMode ? modeIcon[rsvp.travelMode] : "plane"} size={26} />
            </span>
            <div className="flex flex-col gap-1">
              <span className="overline text-sea-700">Your arrival</span>
              <p className="text-lg leading-snug font-semibold">
                {hasArrival ? `${arrivalBits.join(", ")}.` : "Tell us when you land, so we know when to expect you."}
              </p>
              <p className="text-[15px] leading-snug text-ink-soft">
                Check-in opens at {formatClock(checkIn.startsAt)} on {formatWeekdayDate(first.date)}
                {lunch?.endsAt ? `, and lunch is on till ${formatClock(lunch.endsAt)}` : ""}.
              </p>
            </div>
            <Link href="/rsvp?step=arrival" className="btn btn-sm btn-outline-sea shrink-0 sm:ml-auto">
              {hasArrival ? (
                <>
                  <Icon name="pencil" size={18} strokeWidth={2} />
                  Change
                </>
              ) : (
                <>
                  Add my arrival
                  <Icon name="arrow-right" size={18} strokeWidth={2} />
                </>
              )}
            </Link>
          </div>
        </section>
      )}

      {/* Map + address */}
      <section className="grid gap-6 px-4 pb-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-center lg:gap-8 lg:px-24 lg:pb-20">
        <figure className="overflow-hidden rounded-[32px] shadow-[var(--shadow-rest)]">
          <TravelMap className="block h-auto w-full" />
        </figure>
        <div className="card flex flex-col gap-4 rounded-[32px] p-7 lg:p-9">
          <span className="overline text-sea-700">The address</span>
          <h2 className="font-serif text-[28px] leading-tight lg:text-[32px]">{wedding.venue}</h2>
          <address className="text-lg leading-relaxed not-italic">{wedding.address}</address>
          <div className="flex flex-wrap gap-3">
            <a href={wedding.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-sea">
              <Icon name="pin" size={18} strokeWidth={2} />
              Open in Google Maps
            </a>
            <CopyButton text={`${wedding.venue}, ${wedding.address}`} label="Copy address" />
          </div>
          <div className="flex flex-col gap-1 border-t-2 border-dotted border-sand-300 pt-4">
            <span className="text-[15px] text-ink-soft">Resort front desk</span>
            <a href={`tel:${tel}`} className="flex items-center gap-2 self-start text-lg font-semibold">
              <Icon name="phone" size={20} />
              {wedding.venuePhone}
            </a>
            <span className="text-[15px] text-ink-soft">For anything wedding-related, reach us at {contact}.</span>
          </div>
        </div>
      </section>

      {/* Flying in */}
      <section aria-labelledby="fly-title" className="flex flex-col gap-6 px-4 pb-14 lg:gap-8 lg:px-24 lg:pb-16">
        <div className="flex flex-col gap-1 px-1">
          <p className="kicker text-[24px] text-sea-700 lg:text-[30px]">Flying in</p>
          <h2 id="fly-title" className="font-serif text-[28px] leading-[1.15] lg:text-[44px]">
            Goa has two airports. Pick the close one.
          </h2>
        </div>
        <ul className="grid gap-4 md:grid-cols-2 lg:gap-6">
          {travel.airports.map((a) => (
            <li
              key={a.code}
              className={
                a.closest
                  ? "relative flex flex-col gap-3 rounded-[28px] bg-sky-200 p-7 lg:p-8"
                  : "relative flex flex-col gap-3 rounded-[28px] bg-sand-50 p-7 shadow-[var(--shadow-rest)] lg:p-8"
              }
            >
              {a.closest && (
                <span className="absolute top-6 right-6 rounded-full bg-coral-600 px-3 py-1 text-sm font-bold text-white">
                  Closest
                </span>
              )}
              <span className="font-serif text-[52px] leading-none tracking-wide">{a.code}</span>
              <h3 className="text-xl font-bold">{a.name}</h3>
              <div className="flex flex-wrap gap-2">
                {[a.distance, a.time].map((t) => (
                  <span
                    key={t}
                    className={cx("rounded-full px-3 py-1 text-[15px] font-semibold", a.closest ? "bg-sand-50/90" : "bg-sand-200")}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="leading-relaxed text-ink-soft">{a.body}</p>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-3 rounded-[20px] bg-sun-100 px-5 py-4 text-[16px] leading-relaxed">
          <Icon name="plane" size={22} className="mt-0.5 shrink-0" />
          <span>{travel.airportTip}</span>
        </p>
        <div className="flex items-start gap-4 px-1">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-coral-200">
            <Icon name="car" size={22} />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold">Taxis from the airport</h3>
            <p className="max-w-[760px] leading-relaxed text-ink-soft">{travel.cabs}</p>
          </div>
        </div>
      </section>

      {/* Trains and road */}
      <section className="grid gap-6 px-4 pb-14 lg:grid-cols-2 lg:gap-8 lg:px-24 lg:pb-16">
        <div className="card flex flex-col gap-4 rounded-[32px] p-7 lg:p-9">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-palm-100">
              <Icon name="train" size={22} />
            </span>
            <h2 className="font-serif text-[26px] leading-tight lg:text-[30px]">By train</h2>
          </div>
          <ul className="flex flex-col divide-y-2 divide-dotted divide-sand-300">
            {travel.stations.map((st) => (
              <li key={st.name} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <span className="text-lg font-bold">{st.name}</span>
                <span className="text-[15px] font-semibold text-sea-800">
                  {st.distance} · {st.time}
                </span>
                <span className="leading-relaxed text-ink-soft">{st.body}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card flex flex-col gap-4 rounded-[32px] p-7 lg:p-9">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-sun-100">
              <Icon name="car" size={22} />
            </span>
            <h2 className="font-serif text-[26px] leading-tight lg:text-[30px]">By road</h2>
          </div>
          <p className="text-lg leading-relaxed">{travel.road}</p>
        </div>
      </section>

      {/* Heading home */}
      <section id="heading-home" className="scroll-mt-24 px-4 pb-16 lg:px-24 lg:pb-20">
        <div className="relative flex flex-col gap-3 overflow-hidden rounded-[32px] bg-sea-200 p-8 pb-28 sm:pb-8 lg:p-10">
          <Illustration name="boat" className="animate-bob pointer-events-none absolute -right-10 -bottom-1 w-[220px] lg:w-[300px]" />
          <p className="kicker text-2xl text-sea-800">Heading home</p>
          <h2 className="relative max-w-xl font-serif text-[30px] leading-tight text-balance lg:text-[36px]">
            Checkout is at {formatClock(checkout.startsAt)} on {formatWeekdayDate(last.date)}.
          </h2>
          <p className="relative max-w-[560px] text-lg leading-relaxed">
            Flying out the same day? Leave yourself time for goodbyes and the drive. Look for{" "}
            {travel.goingHome.map((g, i) => (
              <span key={g.code}>
                {i > 0 && (i === travel.goingHome.length - 1 ? ", or " : ", ")}
                {g.text} from <strong>{g.code}</strong>
              </span>
            ))}
            .
          </p>
        </div>
      </section>
    </>
  );
}
