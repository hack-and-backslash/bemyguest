import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { CalendarButtonRow, getCalendarLinks } from "@/components/CalendarButtons";
import { Illustration } from "@/components/Decor";
import { Icon } from "@/components/Icon";
import { StickyNote } from "@/components/StickyNote";
import { getPlusOneOf, getRsvp, getViewer, listNotes } from "@/lib/data";
import { getControls, getRsvpGate } from "@/lib/controls";
import { firstName, formatDeadline } from "@/lib/format";
import { dayLabels, drinkStyleLabels, kidsLabel, mealLabels, pointLabels, slotLabels, travelLabels } from "@/lib/types";
import { fmtDay } from "@/lib/rsvp-text";
import { cx } from "@/lib/ui";
import { signOut } from "../actions";

export const metadata: Metadata = { title: "My profile" };

function EditLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-3 mt-auto flex min-h-11 items-center gap-2 self-start rounded-full px-3 font-semibold text-sea-800 no-underline transition-colors hover:bg-sea-700/10"
    >
      <Icon name="pencil" size={18} strokeWidth={2} />
      {children}
    </Link>
  );
}

function Card({ tint, icon, label, children }: { tint: string; icon: React.ComponentProps<typeof Icon>["name"]; label: string; children: React.ReactNode }) {
  return (
    <article className={cx("tile flex min-h-[250px] flex-col gap-2 rounded-[28px] p-7", tint)}>
      <span className="tile-icon flex size-14 items-center justify-center rounded-full bg-sand-50">
        <Icon name={icon} size={26} />
      </span>
      <span className="overline mt-2">{label}</span>
      {children}
    </article>
  );
}

export default async function ProfilePage() {
  const viewer = (await getViewer())!;
  const [rsvp, notes, calendar, host, controls, gate] = await Promise.all([
    getRsvp(viewer.guest.id),
    listNotes(viewer.guest.id),
    getCalendarLinks("all"),
    getPlusOneOf(viewer),
    getControls(),
    getRsvpGate(viewer),
  ]);
  const myNotes = notes.filter((n) => n.guestId === viewer.guest.id);
  const first = firstName(viewer.guest.displayName);
  const coming = rsvp.attending === "yes";

  const status = !rsvp.completed
    ? rsvp.updatedAt
      ? "Half done — pick up where you left off"
      : "Not answered yet"
    : coming
      ? rsvp.days === "both"
        ? "Coming — both days!"
        : `Coming — ${rsvp.days ? dayLabels[rsvp.days].toLowerCase() : ""}`
      : "Not coming this time";

  return (
    <>
      <section className="animate-fade-up relative flex flex-col items-start gap-5 px-5 pt-6 lg:flex-row lg:items-center lg:gap-9 lg:px-28 lg:pt-12">
        <Illustration name="doodle-starfish" className="pointer-events-none absolute top-6 right-28 hidden w-[90px] -rotate-12 opacity-75 lg:block" />
        <Avatar
          name={viewer.guest.displayName || first}
          url={viewer.guest.avatarUrl}
          size={112}
          tone="sun"
          className="font-serif font-normal shadow-[0_0_0_6px_var(--color-sand-100),0_0_0_9px_var(--color-sea-400)]"
        />
        <div className="flex flex-col gap-2">
          <p className="kicker text-[26px] text-sea-700 lg:text-[30px]">My profile</p>
          <h1 className="font-serif text-[34px] leading-[1.1] text-balance lg:text-[50px]">Hi {first}! Here&apos;s your trip at a glance.</h1>
          <p className="text-lg text-ink-soft">
            {gate.closed
              ? `RSVPs are closed now. Need to change something? Message us at ${controls.contact}.`
              : controls.rsvpDeadline && controls.rsvpMode === "deadline"
                ? `Plans changed? No stress — you can update anything here until ${formatDeadline(controls.rsvpDeadline)}.`
                : "Plans changed? No stress — you can update anything here."}
          </p>
        </div>
      </section>

      <section aria-label="Your details" className="grid gap-5 px-4 pt-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 lg:px-28 lg:pt-10">
        <Card tint="bg-sea-200" icon="envelope" label="Your RSVP">
          <span className="font-serif text-[28px] leading-[1.15]">{status}</span>
          {rsvp.completed && (
            <span className="flex items-center gap-1.5 self-start rounded-full bg-sea-700 px-3 py-1.5 text-sm font-bold text-white">
              <Icon name="check" size={16} strokeWidth={2.5} />
              Confirmed
            </span>
          )}
          <EditLink href="/rsvp?step=attending">{rsvp.updatedAt ? "Change RSVP" : "Start my RSVP"}</EditLink>
        </Card>

        {coming && !host && (
          <Card tint="bg-sun-100" icon="user-plus" label="With you">
            <span className="font-serif text-[28px] leading-[1.15]">
              {[rsvp.plusOne ? rsvp.plusOneName || "Your +1" : null, rsvp.kids.length ? kidsLabel(rsvp.kids) : null]
                .filter(Boolean)
                .join(" & ") || "Just you"}
            </span>
            <span className="text-ink-soft">
              {rsvp.plusOne
                ? rsvp.plusOneApproved
                  ? "Your +1 is on the list! We'll send them the link."
                  : "+1 requested. We'll be in touch."
                : rsvp.kids.length
                  ? "The kids stay in your cottage with you."
                  : "Hoping to bring someone? Ask us."}
            </span>
            <EditLink href="/rsvp?step=party">Change</EditLink>
          </Card>
        )}

        {coming && !host && (
          <Card tint="bg-sky-200" icon="cottage" label="Roomie">
            <span className="font-serif text-[28px] leading-[1.15]">
              {rsvp.roomie === "plus_one"
                ? `Your +1${rsvp.plusOneName ? `, ${firstName(rsvp.plusOneName)}` : ""}`
                : rsvp.roomie === "guest"
                  ? rsvp.roomieName || "Someone coming"
                  : rsvp.roomie === "pair_me"
                    ? "We'll pair you up"
                    : "Not picked yet"}
            </span>
            <span className="text-ink-soft">Cottages are for two. We&apos;ll confirm who&apos;s where closer to the day.</span>
            <EditLink href="/rsvp?step=roomie">Change</EditLink>
          </Card>
        )}

        {coming && (
          <Card tint="bg-coral-200" icon="plate" label="Food & drinks">
            <span className="font-serif text-[28px] leading-[1.15]">{rsvp.meal ? mealLabels[rsvp.meal] : "Not picked yet"}</span>
            <span className="text-ink-soft">
              {[
                rsvp.dietaryNotes,
                rsvp.drinks === "no"
                  ? "Mocktails"
                  : rsvp.drinks === "yes"
                    ? rsvp.drinkStyles.map((d) => drinkStyleLabels[d]).join(", ")
                    : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Anything to keep off your plate? Tell us."}
            </span>
            <div className="mt-auto flex flex-wrap gap-x-2">
              <EditLink href="/rsvp?step=food">Food</EditLink>
              <EditLink href="/rsvp?step=drinks">Drinks</EditLink>
            </div>
          </Card>
        )}

        {coming && (
          <Card tint="bg-sand-200" icon="plane" label="Travel">
            <span className="font-serif text-[28px] leading-[1.15]">
              {rsvp.arrivalDate ? `${fmtDay(rsvp.arrivalDate)}${rsvp.arrivalSlot ? ` · ${slotLabels[rsvp.arrivalSlot].toLowerCase()}` : ""}` : "Not set yet"}
            </span>
            <span className="text-ink-soft">
              {[
                rsvp.arrivalPoint ? pointLabels[rsvp.arrivalPoint] : rsvp.travelMode && `By ${travelLabels[rsvp.travelMode].toLowerCase()}`,
                rsvp.departureDate && `Home ${fmtDay(rsvp.departureDate)}`,
              ]
                .filter(Boolean)
                .join(" · ") || "Flight, train or road trip?"}
            </span>
            <div className="mt-auto flex flex-wrap gap-x-2">
              <EditLink href="/rsvp?step=arrival">Arrival</EditLink>
              <EditLink href="/rsvp?step=departure">Going home</EditLink>
            </div>
          </Card>
        )}

        <Card tint="bg-palm-100" icon="calendar" label="Calendar">
          <span className="font-serif text-[28px] leading-[1.15]">Save both days</span>
          <CalendarButtonRow links={calendar} className="mt-auto" />
        </Card>

        <article className="tile flex min-h-[250px] flex-col gap-2 rounded-[28px] border-2 border-dashed border-sand-300 bg-sand-50 p-7">
          <span className="tile-icon flex size-14 items-center justify-center rounded-full bg-sea-200">
            <Icon name="shell" size={26} />
          </span>
          <span className="overline mt-2">Your note on the wall</span>
          {myNotes.length > 0 ? (
            <div className="mt-2 max-w-[260px]">
              <StickyNote note={myNotes[0]} index={0} size="sm" />
            </div>
          ) : (
            <>
              <span className="font-serif text-[28px] leading-[1.15]">Nothing yet!</span>
              <span className="text-ink-soft">Say hi — it makes our day.</span>
            </>
          )}
          <Link
            href="/wall"
            className="-ml-3 mt-auto flex min-h-11 items-center gap-2 self-start rounded-full px-3 font-semibold text-sea-800 no-underline hover:bg-sea-700/10"
          >
            <Icon name="send" size={18} strokeWidth={2} />
            {myNotes.length > 0 ? "See the wall" : "Leave a note"}
          </Link>
        </article>
      </section>

      <section id="help" className="flex flex-col gap-4 px-5 pt-10 pb-14 sm:flex-row sm:items-center sm:justify-between lg:px-28 lg:pb-16">
        <p className="flex items-center gap-2.5 text-ink-soft">
          <Icon name="ring" />
          Need a hand? Reach us at {controls.contact}
        </p>
        <div className="flex items-center gap-2">
          {viewer.isAdmin && (
            <Link href="/admin" className="btn btn-sm btn-outline-sea">
              Couple&apos;s dashboard
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className="btn btn-sm btn-ghost">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
