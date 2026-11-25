import Link from "next/link";
import { formatDeadline } from "@/lib/format";
import { dayLabels, mealLabels, plusOneLabel, travelLabels, type Rsvp } from "@/lib/types";

/** After the RSVP deadline: your answers, read-only, and who to message for changes. */
export function RsvpClosed({
  rsvp,
  name,
  deadline,
  contact,
}: {
  rsvp: Rsvp;
  name: string;
  deadline: string | null;
  contact: string;
}) {
  const first = name.split(" ")[0] || "friend";
  const answered = rsvp.completed && rsvp.attending !== null;
  const chips = answered
    ? rsvp.attending === "no"
      ? ["Can't make it"]
      : ([
          rsvp.days && dayLabels[rsvp.days],
          plusOneLabel(rsvp),
          rsvp.meal && mealLabels[rsvp.meal],
          rsvp.travelMode && `Arriving by ${travelLabels[rsvp.travelMode].toLowerCase()}`,
        ].filter(Boolean) as string[])
    : [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-2 pb-12 lg:pt-8">
      <div className="card flex flex-col gap-3.5 rounded-[32px] bg-white p-7 lg:px-9 lg:py-8">
        <p className="kicker text-[28px] text-sea-700">My RSVP</p>
        <h1 className="font-serif text-[32px] leading-[1.12] lg:text-[40px]">
          {answered ? `Here's what we've got, ${first}.` : deadline ? `RSVPs closed on ${formatDeadline(deadline)}.` : "RSVPs are closed."}
        </h1>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-sea-200 px-3.5 py-2 text-[15px] font-semibold">
                {c}
              </span>
            ))}
          </div>
        )}
        <p className="max-w-[480px] text-lg leading-relaxed text-ink-soft">
          RSVPs are closed now. Need to change something? Message us at {contact} and we&apos;ll sort it out.
        </p>
        <div className="mt-1 flex flex-wrap gap-3">
          <Link href="/schedule" className="btn btn-primary">
            See the plan
          </Link>
          <Link href="/" className="btn btn-ghost">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
