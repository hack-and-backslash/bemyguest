import type { Metadata } from "next";
import { getPlusOneOf, getRsvp, getViewer, roomieCandidates } from "@/lib/data";
import { eventsOn, wedding } from "@/content/wedding";
import { travel } from "@/content/venue";
import { isCalendarReady } from "@/lib/calendar";
import { formatClock, formatWeekdayDate } from "@/lib/format";
import { getControls, getRsvpGate } from "@/lib/controls";
import { RsvpClosed } from "./RsvpClosed";
import { RsvpFlow } from "./RsvpFlow";

export const metadata: Metadata = { title: "RSVP" };

export default async function RsvpPage({ searchParams }: PageProps<"/rsvp">) {
  const viewer = (await getViewer())!;
  const [rsvp, host, gate, controls, candidates] = await Promise.all([
    getRsvp(viewer.guest.id),
    getPlusOneOf(viewer),
    getRsvpGate(viewer),
    getControls(),
    roomieCandidates(viewer),
  ]);
  if (gate.closed) {
    return <RsvpClosed rsvp={rsvp} name={viewer.guest.displayName} deadline={controls.rsvpDeadline} contact={controls.contact} />;
  }
  const { step } = await searchParams;
  const [d1, d2] = wedding.days;
  const list = (id: typeof d1.id) =>
    eventsOn(id)
      .filter((e) => e.highlight || e.meal)
      .filter((e, i, arr) => arr.findIndex((x) => x.title === e.title) === i)
      .map((e) => e.title.toLowerCase())
      .join(", ");
  const checkIn = eventsOn(d1.id)[0];
  const last = wedding.days[wedding.days.length - 1];
  const checkout = eventsOn(last.id).find((e) => /check-?out/i.test(e.title));
  const dayBefore = new Date(Date.parse(`${d1.date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const flights = travel.goingHome
    .map((g, i) => `${i ? "from" : "From"} ${g.code}, ${g.text.replace(/^a flight/, "pick a flight")}`)
    .join("; ");
  const note = (code: string) =>
    (travel.airports.find((x) => x.code === code) ?? travel.stations.find((x) => x.name.includes(`(${code})`)))?.time ?? "";

  return (
    <RsvpFlow
      initial={rsvp}
      initialName={viewer.guest.displayName}
      host={host}
      startStep={typeof step === "string" ? step : undefined}
      calendarReady={isCalendarReady("all")}
      dayNotes={{
        both: `${formatWeekdayDate(d1.date)} & ${formatWeekdayDate(d2.date)}: ${d1.summary.toLowerCase()}, ${d2.summary.toLowerCase()}`,
        day1: `${formatWeekdayDate(d1.date)}: ${list(d1.id)}`,
        day2: `${formatWeekdayDate(d2.date)}: ${list(d2.id)}`,
      }}
      checkInNote={`Check-in opens at ${formatClock(checkIn.startsAt)} on ${formatWeekdayDate(d1.date)}.`}
      checkoutNote={`Checkout is at ${checkout ? formatClock(checkout.startsAt) : "11 AM"} on ${formatWeekdayDate(last.date)}, after breakfast. Flying out? ${flights}.`}
      trip={{ arrive: [dayBefore, d1.date, d2.date], leave: [d1.date, d2.date, last.date], day1: d1.date, day2: d2.date, day3: last.date }}
      pointNotes={{ GOI: note("GOI"), GOX: note("GOX"), VSG: note("VSG"), MAO: note("MAO") }}
      candidates={candidates}
    />
  );
}
