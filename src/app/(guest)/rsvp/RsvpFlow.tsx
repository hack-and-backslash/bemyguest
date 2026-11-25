"use client";

/* eslint-disable @next/next/no-img-element -- small illustrated avatars */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import {
  dayLabels,
  drinkStyleLabels,
  kidsLabel,
  mealLabels,
  needLabels,
  plusOneLabel,
  pointLabels,
  slotLabels,
  spiritLabels,
  travelLabels,
  type ArrivalPoint,
  type Days,
  type DrinkStyle,
  type Meal,
  type Need,
  type RideHelp,
  type Rsvp,
  type Spirit,
  type TimeSlot,
  type TravelMode,
} from "@/lib/types";
import { cx } from "@/lib/ui";
import { saveRsvpAction } from "../actions";
import { fmtDay, fmtPhone, joinPhone, splitPhone } from "@/lib/rsvp-text";
import { Choice, Chips, DayPicker, KidsEditor, PhoneInput, RoomiePicker, Summary, toggle, type Candidate, type SummaryStep } from "./RsvpParts";

type Q = "attending" | "days" | "party" | "roomie" | "food" | "drinks" | "arrival" | "departure" | "contact";
type Step = Q | "review" | "done";
/** `host`: set when this guest is someone's approved +1 (their first name); they skip "who's with you" and "roomie". */
type Answers = Rsvp & { name: string; host: string | null };

const QUESTION_STEPS: Q[] = ["attending", "days", "party", "roomie", "food", "drinks", "arrival", "departure", "contact"];
const STEP_LABELS: Record<Q, string> = {
  attending: "Coming?",
  days: "Which days",
  party: "Who's with you",
  roomie: "Roomie",
  food: "Food",
  drinks: "Drinks",
  arrival: "Getting here",
  departure: "Heading home",
  contact: "Last bits",
};
const QUESTIONS: Record<Q | "review", string> = {
  attending: "Will you be joining us in Goa?",
  days: "Yay! Which days can you make it?",
  party: "Who's coming with you?",
  roomie: "Cottages are for two. Who'd you like to share with?",
  food: "Let's sort your food lineup for the weekend.",
  drinks: "Will you be raising a glass with us?",
  arrival: "When do you get to Goa?",
  departure: "And when are you heading home?",
  contact: "Last bits! How do we reach you?",
  review: "Here's everything we've got. All good?",
};
/** Older links (?step=plusOne, ?step=meal) still land somewhere sensible. */
const STEP_ALIASES: Record<string, Q> = { name: "attending", plusOne: "party", meal: "food" };

const SLOT_OPTIONS = (["morning", "afternoon", "evening", "late"] as TimeSlot[]).map((v) => ({ value: v, label: slotLabels[v] }));
const MODE_OPTIONS = (["flight", "train", "road"] as TravelMode[]).map((v) => ({ value: v, label: travelLabels[v] }));
const POINTS: Record<"flight" | "train", ArrivalPoint[]> = { flight: ["GOI", "GOX"], train: ["VSG", "MAO"] };

function nextOf(step: Step, a: Answers): Step {
  switch (step) {
    case "attending":
      return a.attending === "no" ? "done" : "days";
    case "days":
      return a.host ? "food" : "party";
    case "party":
      return "roomie";
    case "roomie":
      return "food";
    case "food":
      return "drinks";
    case "drinks":
      return "arrival";
    case "arrival":
      return "departure";
    case "departure":
      return "contact";
    case "contact":
      return "review";
    default:
      return "done";
  }
}

function answered(step: Step, a: Answers) {
  switch (step) {
    case "attending":
      return a.attending !== null;
    case "days":
      return a.days !== null;
    case "party":
      return a.plusOne !== null;
    case "roomie":
      return a.roomie !== null;
    case "food":
      return a.meal !== null;
    case "drinks":
      return a.drinks === "no" || (a.drinks === "yes" && a.drinkStyles.length > 0);
    case "arrival":
      return !!a.arrivalDate && !!a.arrivalSlot && !!a.travelMode && (a.travelMode === "road" || !!a.arrivalPoint);
    case "departure":
      return !!a.departureDate && !!a.departureSlot && !!a.rideHelp;
    case "contact":
      return !!a.whatsapp;
    case "review":
      return a.completed;
    default:
      return false;
  }
}

/** Walk the question path, stopping at `stopAt`, the first unanswered step, or done. */
function walk(a: Answers, stopAt?: Step): Step[] {
  const path: Step[] = ["attending"];
  let cur: Step = "attending";
  for (let i = 0; i < 14; i++) {
    if (cur === stopAt) break;
    if (!stopAt && !answered(cur, a)) break;
    const next = nextOf(cur, a);
    if (next === "done" && !a.completed && !stopAt) break;
    path.push(next);
    cur = next;
    if (cur === "done") break;
  }
  return path;
}

function roomieText(a: Answers) {
  if (a.roomie === "plus_one") return `My +1${a.plusOneName ? `, ${a.plusOneName}` : ""}`;
  if (a.roomie === "guest") return a.roomieName || "Someone coming";
  return a.roomie === "pair_me" ? "Pair me up, I'm easy" : "";
}

function drinksText(a: Answers) {
  if (a.drinks === "no") return "Mocktails for me";
  return [a.drinkStyles.map((s) => drinkStyleLabels[s]).join(", "), a.spirits.map((s) => spiritLabels[s]).join(", "), a.cocktailFavs]
    .filter(Boolean)
    .join(" · ");
}

function answerText(step: Step, a: Answers) {
  switch (step) {
    case "attending":
      return a.attending === "no" ? "Sadly, I can't make it" : "Wouldn't miss it!";
    case "days":
      return a.days ? (a.days === "both" ? "Both days!" : dayLabels[a.days]) : "";
    case "party":
      return [a.plusOne ? plusOneLabel(a) : null, kidsLabel(a.kids)].filter(Boolean).join(" · ") || "Just me";
    case "roomie":
      return roomieText(a);
    case "food":
      return [a.meal && mealLabels[a.meal], a.dietaryNotes].filter(Boolean).join(" · ");
    case "drinks":
      return drinksText(a);
    case "arrival":
      return [
        a.arrivalDate && fmtDay(a.arrivalDate),
        a.arrivalSlot && slotLabels[a.arrivalSlot].toLowerCase(),
        a.travelMode && (a.arrivalPoint ? `${travelLabels[a.travelMode]} · ${a.arrivalPoint}` : travelLabels[a.travelMode]),
      ]
        .filter(Boolean)
        .join(" · ");
    case "departure":
      return [a.departureDate && fmtDay(a.departureDate), a.departureSlot && slotLabels[a.departureSlot].toLowerCase()]
        .filter(Boolean)
        .join(" · ");
    case "contact":
      return a.whatsapp ? fmtPhone(a.whatsapp) : "";
    default:
      return "";
  }
}

export type TripDays = {
  /** Chips for "when do you get here" and "when are you heading home" (YYYY-MM-DD). */
  arrive: string[];
  leave: string[];
  day1: string;
  day2: string;
  day3: string;
};

export function RsvpFlow({
  initial,
  initialName,
  host,
  startStep,
  calendarReady,
  dayNotes,
  checkInNote,
  checkoutNote,
  trip,
  pointNotes,
  candidates,
}: {
  initial: Rsvp;
  initialName: string;
  /** First name of the guest who asked to bring them, if they're an approved +1. */
  host: string | null;
  startStep?: string;
  calendarReady: boolean;
  /** One line per option on the "which days" question. */
  dayNotes: Record<Days, string>;
  /** e.g. "Check-in opens at 2 PM on Sat 30 Jan." */
  checkInNote: string;
  /** Checkout time and flights that work on the last day. */
  checkoutNote: string;
  trip: TripDays;
  /** "10–15 min by cab", by airport/station. */
  pointNotes: Record<ArrivalPoint, string>;
  /** Guests who've signed in, for picking a roommate. */
  candidates: Candidate[];
}) {
  const steps = host ? QUESTION_STEPS.filter((k) => k !== "party" && k !== "roomie") : QUESTION_STEPS;
  const [a, setA] = useState<Answers>({ ...initial, name: initialName, host });
  const [path, setPath] = useState<Step[]>(() => {
    const start = { ...initial, name: initialName, host };
    const wanted = startStep ? (STEP_ALIASES[startStep] ?? startStep) : undefined;
    if (wanted && (steps as string[]).includes(wanted)) {
      const p = walk(start, wanted as Step);
      if (p[p.length - 1] === wanted) return p;
    }
    return walk(start);
  });
  // Came here to change one answer (from My profile, Review or the done card): save, then go back.
  const [revisit, setRevisit] = useState(!!startStep);
  const [nameOpen, setNameOpen] = useState(false);
  const [phone, setPhone] = useState<[string, string]>(() => splitPhone(initial.whatsapp));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const questionRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  const cur = path[path.length - 1];

  useEffect(() => {
    if (mounted.current) questionRef.current?.focus();
    mounted.current = true;
  }, [cur]);

  const set = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }));

  // Sensible defaults for the travel days, from the days they picked.
  const arriveDate = a.arrivalDate || (a.days === "day2" ? trip.day2 : trip.day1);
  const leaveDate = a.departureDate || (a.days === "day1" ? trip.day2 : trip.day3);

  function commit(patch: Partial<Answers>, advance: boolean) {
    const next = { ...a, ...patch };
    setA(next);
    setError(null);
    const { name, ...rest } = patch;
    // Only the server decides these.
    delete rest.host;
    delete rest.plusOneApproved;
    const serverPatch = name !== undefined ? { ...rest, displayName: name } : rest;
    startSaving(async () => {
      const res = await saveRsvpAction(serverPatch);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const saved = { ...next, plusOneApproved: res.rsvp.plusOneApproved, roomieName: res.rsvp.roomieName, whatsapp: res.rsvp.whatsapp };
      setA((prev) => ({ ...prev, plusOneApproved: saved.plusOneApproved, roomieName: saved.roomieName, whatsapp: saved.whatsapp }));
      if (!advance) return;
      // Changing one answer: back to the summary (or the next thing still missing).
      if (revisit) setPath(walk(saved));
      else setPath((p) => [...p, nextOf(p[p.length - 1], saved)]);
    });
  }

  function jumpTo(step: SummaryStep, editName?: boolean) {
    setRevisit(true);
    setError(null);
    setNameOpen(!!editName);
    setPath(walk(a, step));
  }

  const skipped = (k: Q) => a.attending === "no" && k !== "attending";
  const total = steps.filter((k) => !skipped(k)).length;
  const num = Math.min(new Set(path.filter((k) => k !== "done" && k !== "review")).size, total);
  const pct = cur === "done" || cur === "review" ? 100 : Math.round(((num - 1) / total) * 100);

  const history = path
    .slice(0, -1)
    .filter((k): k is Q => k !== "done" && k !== "review")
    .map((k) => ({ k, q: QUESTIONS[k], ans: answerText(k, a) }));
  const recent = history.slice(-2);
  const hiddenCount = history.length - recent.length;

  const kidsOk = a.kids.every((k) => k.name.trim() && k.age >= 0);
  const blocked: Partial<Record<Step, boolean>> = {
    party: (!!a.plusOne && (!a.plusOneName.trim() || !a.plusOneEmail.trim())) || !kidsOk,
    roomie: !a.roomieGuestId && !a.roomieName.trim(),
    food: !a.meal,
    drinks: a.drinkStyles.length === 0,
    arrival: !arriveDate || !a.arrivalSlot || !a.travelMode || (a.travelMode !== "road" && !a.arrivalPoint),
    departure: !leaveDate || !a.departureSlot || !a.rideHelp,
    contact: !phone[1].trim(),
  };
  const showContinue =
    (cur === "party" && (a.plusOne === true || a.kids.length > 0)) ||
    (cur === "roomie" && a.roomie === "guest") ||
    (cur === "drinks" && a.drinks === "yes") ||
    cur === "food" ||
    cur === "arrival" ||
    cur === "departure" ||
    cur === "contact" ||
    cur === "review";
  const sent = initial.completed || a.completed;

  function onContinue() {
    if (cur === "party") {
      commit(
        {
          plusOne: !!a.plusOne,
          plusOneName: a.plusOne ? a.plusOneName.trim() : "",
          plusOneEmail: a.plusOne ? a.plusOneEmail.trim().toLowerCase() : "",
          kids: a.kids.map((k) => ({ name: k.name.trim(), age: k.age })),
          // No +1 any more, so "share with my +1" no longer makes sense.
          ...(!a.plusOne && a.roomie === "plus_one" ? { roomie: null } : {}),
        },
        true,
      );
    } else if (cur === "roomie") commit({ roomie: "guest", roomieGuestId: a.roomieGuestId, roomieName: a.roomieName.trim() }, true);
    else if (cur === "food") commit({ meal: a.meal, dietaryNotes: a.dietaryNotes.trim() }, true);
    else if (cur === "drinks") {
      commit(
        {
          drinks: "yes",
          drinkStyles: a.drinkStyles,
          spirits: a.drinkStyles.includes("straight") ? a.spirits : [],
          cocktailFavs: a.drinkStyles.includes("cocktails") ? a.cocktailFavs.trim() : "",
        },
        true,
      );
    } else if (cur === "arrival") {
      commit(
        {
          arrivalDate: arriveDate,
          arrivalSlot: a.arrivalSlot,
          travelMode: a.travelMode,
          arrivalPoint: a.travelMode === "road" ? null : a.arrivalPoint,
        },
        true,
      );
    } else if (cur === "departure") commit({ departureDate: leaveDate, departureSlot: a.departureSlot, rideHelp: a.rideHelp }, true);
    else if (cur === "contact") commit({ whatsapp: joinPhone(phone[0], phone[1]), needs: a.needs, notes: a.notes.trim() }, true);
    else if (cur === "review") commit({ completed: true }, true);
  }

  const bubble = (text: string) => (
    <div className="flex items-end gap-2.5">
      <CoupleAvatar size={40} />
      <p className="rounded-[20px_20px_20px_6px] bg-white px-4 py-3 text-[15px] text-ink-soft shadow-[0_2px_8px_rgb(31_58_61/0.05)] lg:text-base">
        {text}
      </p>
    </div>
  );
  const first = a.name.split(" ")[0] || "friend";
  const card = "card flex flex-col gap-4 rounded-3xl bg-white p-5 lg:p-6";
  const hint = "text-sm text-ink-soft";

  return (
    <div className="lg:grid lg:grid-cols-[480px_minmax(0,1fr)] lg:gap-14 lg:px-12 lg:pt-4 lg:pb-12">
      {/* Progress panel (desktop) */}
      <aside className="relative hidden flex-col gap-2.5 self-start overflow-hidden rounded-[36px] bg-sea-200 px-10 py-9 lg:flex">
        <img src="/illustrations/frond.svg" alt="" className="pointer-events-none absolute -top-10 -right-16 w-[260px] rotate-[40deg] opacity-35" />
        <img src="/illustrations/couple.svg" alt="The couple, smiling" className="animate-bob relative h-[183px] w-[170px]" />
        <p className="kicker relative mt-1.5 text-[28px] text-sea-700">The RSVP</p>
        <h1 className="relative font-serif text-[40px] leading-[1.12]">Let&apos;s get you on the list.</h1>
        <p className="relative text-[17px] leading-relaxed">Mostly taps, about two minutes. Change anything later from My profile.</p>
        <ol aria-label="Your progress" className="relative mt-4 flex flex-col gap-1">
          {steps.map((k) => {
            const skip = skipped(k);
            const current = k === cur;
            const done = !current && path.includes(k) && !skip;
            return (
              <li
                key={k}
                className={cx(
                  "flex min-h-8 items-center gap-3.5 text-base",
                  current ? "font-bold" : done ? "font-semibold" : "font-medium text-ink-soft",
                )}
              >
                {done && (
                  <span className="flex size-7 items-center justify-center rounded-full bg-sea-700 text-white">
                    <Icon name="check" size={16} strokeWidth={2.5} />
                  </span>
                )}
                {current && (
                  <span className="flex size-7 items-center justify-center rounded-full border-[3px] border-coral-600">
                    <span className="size-2.5 rounded-full bg-coral-600" />
                  </span>
                )}
                {!done && !current && !skip && <span className="size-7 rounded-full border-2 border-dashed border-ink-muted" />}
                {skip && (
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#e4f5ef] text-sm font-bold text-ink-muted">
                    –
                  </span>
                )}
                <span>{STEP_LABELS[k]}</span>
                <span className="ml-auto max-w-[180px] truncate text-[13px] font-semibold text-ink-soft">
                  {skip ? "skipped" : done ? answerText(k, a).split(" · ")[0] : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Conversation */}
      <section aria-label="RSVP conversation" className="flex min-h-[calc(100dvh-4rem)] flex-col lg:min-h-0">
        <div className="flex items-center gap-3 px-4 pt-1 lg:gap-4 lg:px-0 lg:pt-2">
          <Link href="/" aria-label="Close RSVP" className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink lg:hidden">
            <Icon name="close" strokeWidth={2} />
          </Link>
          <span className="text-sm font-bold tracking-[0.04em] text-sea-700 lg:text-[15px]">
            {cur === "done" ? "All done!" : cur === "review" ? "Almost there" : `Step ${num} of ${total}`}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand-200">
            <span
              className="block h-full rounded-full bg-sea-700 transition-[width] duration-400 ease-[var(--ease-soft)]"
              style={{ width: `${pct}%` }}
            />
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-4 px-4 pt-5 pb-6 lg:gap-[18px] lg:px-0">
          <h1 className="sr-only lg:hidden">RSVP</h1>
          {hiddenCount > 0 && cur !== "review" && cur !== "done" && (
            <p className="self-center text-sm font-semibold text-ink-soft">
              {hiddenCount === 1 ? "1 earlier answer" : `${hiddenCount} earlier answers`}
            </p>
          )}
          {cur !== "review" &&
            cur !== "done" &&
            recent.map((h) => (
              <div key={h.k} className="flex flex-col gap-2">
                {bubble(h.q)}
                <p className="self-end rounded-[20px_20px_6px_20px] bg-sea-700 px-4 py-3 text-[15px] font-semibold text-white lg:text-base">
                  {h.ans}
                </p>
              </div>
            ))}

          <div aria-live="polite" className="flex flex-col gap-3.5">
            {cur !== "done" && (
              <div key={cur} className="animate-fade-up flex items-end gap-2.5">
                <CoupleAvatar size={48} />
                <h2
                  ref={questionRef}
                  tabIndex={-1}
                  className="rounded-[24px_24px_24px_6px] bg-white px-5 py-4 font-serif text-[21px] leading-[1.25] shadow-[0_6px_18px_rgb(31_58_61/0.08)] outline-none lg:text-[26px]"
                >
                  {cur === "attending"
                    ? host
                      ? `${host} asked to bring you, and we'd love that! Will you be joining us in Goa, ${first}?`
                      : `Will you be joining us in Goa, ${first}?`
                    : QUESTIONS[cur]}
                </h2>
              </div>
            )}

            <div key={`${cur}-body`} className="animate-fade-up [animation-delay:120ms] lg:ml-[58px]">
              {cur === "attending" && (
                <div className="flex flex-col gap-3">
                  <div role="group" aria-label="Will you attend?" className="grid gap-3 sm:grid-cols-2">
                    <Choice
                      on={a.attending === "yes"}
                      disabled={saving}
                      onClick={() => commit({ attending: "yes", completed: a.attending === "no" ? false : a.completed }, true)}
                    >
                      Wouldn&apos;t miss it!
                    </Choice>
                    <Choice on={a.attending === "no"} disabled={saving} onClick={() => commit({ attending: "no", completed: true }, true)}>
                      Sadly, I can&apos;t make it
                    </Choice>
                  </div>
                  {!nameOpen ? (
                    <button
                      type="button"
                      className="self-start rounded-full px-1 py-1 text-sm font-semibold text-sea-800 underline-offset-2 hover:underline"
                      onClick={() => setNameOpen(true)}
                    >
                      Not {first}? Fix your name
                    </button>
                  ) : (
                    <div className={card}>
                      <label htmlFor="rsvp-name" className="text-[15px] font-semibold">
                        Your name, as it should appear on the guest wall
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <input
                          id="rsvp-name"
                          className="field min-w-0 flex-1"
                          value={a.name}
                          autoComplete="name"
                          maxLength={80}
                          onChange={(e) => set({ name: e.target.value })}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-sea"
                          disabled={saving || !a.name.trim()}
                          onClick={() => {
                            commit({ name: a.name.trim() }, false);
                            setNameOpen(false);
                          }}
                        >
                          Save name
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cur === "days" && (
                <div role="group" aria-label="Which days" className="flex flex-col gap-3">
                  {(
                    [
                      ["both", dayNotes.both],
                      ["day1", dayNotes.day1],
                      ["day2", dayNotes.day2],
                    ] as [Days, string][]
                  ).map(([d, sub]) => (
                    <Choice key={d} on={a.days === d} disabled={saving} onClick={() => commit({ days: d }, true)}>
                      <span className="flex flex-col gap-0.5">
                        <span>{dayLabels[d]}</span>
                        <span className="text-sm font-medium text-ink-soft">{sub}</span>
                      </span>
                    </Choice>
                  ))}
                </div>
              )}

              {cur === "party" && (
                <div className="flex flex-col gap-3.5">
                  <div role="group" aria-label="Who's coming with you" className="grid gap-3 sm:grid-cols-3">
                    <Choice
                      on={a.plusOne === false && a.kids.length === 0}
                      disabled={saving}
                      onClick={() =>
                        commit(
                          {
                            plusOne: false,
                            plusOneName: "",
                            plusOneEmail: "",
                            plusOneApproved: false,
                            kids: [],
                            ...(a.roomie === "plus_one" ? { roomie: null } : {}),
                          },
                          true,
                        )
                      }
                    >
                      Just me
                    </Choice>
                    <Choice on={a.plusOne === true} disabled={saving} onClick={() => set({ plusOne: a.plusOne === true ? false : true })}>
                      I&apos;d like to bring a +1
                    </Choice>
                    <Choice
                      on={a.kids.length > 0}
                      disabled={saving}
                      onClick={() => set({ kids: a.kids.length ? [] : [{ name: "", age: -1 }], plusOne: a.plusOne ?? false })}
                    >
                      I&apos;m bringing kids
                    </Choice>
                  </div>
                  {a.plusOne === true && (
                    <div className={cx(card, "animate-fade-up gap-2.5")}>
                      {initial.plusOneApproved && a.plusOneEmail === initial.plusOneEmail ? (
                        <p className="rounded-2xl bg-sea-200 px-4 py-3 text-[15px] font-semibold text-sea-800">
                          Good news: {initial.plusOneName} is on the list! We&apos;ll send them the link to RSVP themselves.
                        </p>
                      ) : (
                        <p className="text-[15px] text-ink-soft">
                          We&apos;re keeping it small, so plus-ones aren&apos;t a given. Tell us who, and we&apos;ll see what we can do.
                        </p>
                      )}
                      <label htmlFor="rsvp-plus" className="mt-1 text-[15px] font-semibold">
                        Their name
                      </label>
                      <input
                        id="rsvp-plus"
                        className="field"
                        value={a.plusOneName}
                        maxLength={80}
                        autoComplete="off"
                        placeholder="First and last name"
                        onChange={(e) => set({ plusOneName: e.target.value })}
                      />
                      <label htmlFor="rsvp-plus-email" className="mt-1 text-[15px] font-semibold">
                        Their email
                      </label>
                      <input
                        id="rsvp-plus-email"
                        type="email"
                        inputMode="email"
                        className="field"
                        value={a.plusOneEmail}
                        maxLength={254}
                        autoComplete="off"
                        placeholder="name@gmail.com"
                        aria-describedby="rsvp-plus-email-hint"
                        onChange={(e) => set({ plusOneEmail: e.target.value })}
                      />
                      <p id="rsvp-plus-email-hint" className={hint}>
                        The one they sign in to Google with. If it works out, we&apos;ll send them the link so they can RSVP themselves.
                        {initial.plusOneApproved && a.plusOneEmail !== initial.plusOneEmail && " Changing who it is sends us a new request."}
                      </p>
                    </div>
                  )}
                  {a.kids.length > 0 && (
                    <div className={cx(card, "animate-fade-up")}>
                      <KidsEditor kids={a.kids} onChange={(kids) => set({ kids })} />
                    </div>
                  )}
                </div>
              )}

              {cur === "roomie" && (
                <div className="flex flex-col gap-3.5">
                  <div role="group" aria-label="Who you'd share with" className="flex flex-col gap-3">
                    {a.plusOne && (
                      <Choice on={a.roomie === "plus_one"} disabled={saving} onClick={() => commit({ roomie: "plus_one" }, true)}>
                        <span className="flex flex-col gap-0.5">
                          <span>With my +1{a.plusOneName ? `, ${a.plusOneName.split(" ")[0]}` : ""}</span>
                          {!a.plusOneApproved && (
                            <span className="text-sm font-medium text-ink-soft">If we can make room for them. If not, we&apos;ll pair you up.</span>
                          )}
                        </span>
                      </Choice>
                    )}
                    <Choice on={a.roomie === "guest"} disabled={saving} onClick={() => set({ roomie: "guest" })}>
                      Someone else who&apos;s coming
                    </Choice>
                    <Choice on={a.roomie === "pair_me"} disabled={saving} onClick={() => commit({ roomie: "pair_me" }, true)}>
                      <span className="flex flex-col gap-0.5">
                        <span>Pair me up, I&apos;m easy</span>
                        <span className="text-sm font-medium text-ink-soft">We&apos;ll find you a good one.</span>
                      </span>
                    </Choice>
                  </div>
                  {a.roomie === "guest" && (
                    <div className={cx(card, "animate-fade-up")}>
                      <RoomiePicker
                        candidates={candidates}
                        guestId={a.roomieGuestId}
                        name={a.roomieName}
                        onPick={({ guestId, name }) => set({ roomieGuestId: guestId, roomieName: name })}
                      />
                    </div>
                  )}
                  {a.kids.length > 0 && (
                    <p className={hint}>
                      {a.kids.map((k) => k.name).filter(Boolean).join(" and ") || "Your kids"} will be in your cottage with you.
                    </p>
                  )}
                </div>
              )}

              {cur === "food" && (
                <div className={card}>
                  <p id="meal-q" className="text-[15px] font-semibold">
                    {a.kids.length ? "Veg or non-veg, for you and the kids?" : "Veg or non-veg? It's the same for every meal."}
                  </p>
                  <div role="group" aria-labelledby="meal-q" className="grid grid-cols-2 gap-2.5">
                    {(["veg", "nonveg"] as Meal[]).map((m) => (
                      <Choice key={m} on={a.meal === m} onClick={() => set({ meal: m })}>
                        {mealLabels[m]}
                      </Choice>
                    ))}
                  </div>
                  <label htmlFor="rsvp-diet" className="mt-1 text-[15px] font-semibold">
                    Anything we should keep off your plate{a.kids.length ? " (or the kids')" : ""}?{" "}
                    <span className="font-medium text-ink-soft">(optional)</span>
                  </label>
                  <input
                    id="rsvp-diet"
                    className="field"
                    value={a.dietaryNotes}
                    maxLength={200}
                    placeholder="Allergies, dislikes, the works"
                    onChange={(e) => set({ dietaryNotes: e.target.value })}
                  />
                </div>
              )}

              {cur === "drinks" && (
                <div className="flex flex-col gap-3.5">
                  <div role="group" aria-label="Drinks" className="grid gap-3 sm:grid-cols-2">
                    <Choice on={a.drinks === "yes"} disabled={saving} onClick={() => set({ drinks: "yes" })}>
                      Yes please!
                    </Choice>
                    <Choice
                      on={a.drinks === "no"}
                      disabled={saving}
                      onClick={() => commit({ drinks: "no", drinkStyles: [], spirits: [], cocktailFavs: "" }, true)}
                    >
                      I&apos;ll stick to mocktails
                    </Choice>
                  </div>
                  {a.drinks === "yes" && (
                    <div className={cx(card, "animate-fade-up")}>
                      <Chips<DrinkStyle>
                        label="What do you usually go for? Pick any."
                        multi
                        options={(["cocktails", "straight", "beer", "wine"] as DrinkStyle[]).map((v) => ({
                          value: v,
                          label: v === "straight" ? "Straight up (whisky, rum…)" : drinkStyleLabels[v],
                        }))}
                        value={a.drinkStyles}
                        onChange={(v) => set({ drinkStyles: toggle(a.drinkStyles, v) })}
                      />
                      {a.drinkStyles.includes("cocktails") && (
                        <div className="flex flex-col gap-2">
                          <label htmlFor="rsvp-cocktails" className="text-[15px] font-semibold">
                            Any favourite cocktails? <span className="font-medium text-ink-soft">(optional)</span>
                          </label>
                          <input
                            id="rsvp-cocktails"
                            className="field"
                            maxLength={80}
                            value={a.cocktailFavs}
                            placeholder="e.g. mojito, old fashioned"
                            onChange={(e) => set({ cocktailFavs: e.target.value })}
                          />
                        </div>
                      )}
                      {a.drinkStyles.includes("straight") && (
                        <Chips<Spirit>
                          label="Your pour? (optional)"
                          multi
                          options={(["whisky", "rum", "vodka", "gin", "tequila"] as Spirit[]).map((v) => ({ value: v, label: spiritLabels[v] }))}
                          value={a.spirits}
                          onChange={(v) => set({ spirits: toggle(a.spirits, v) })}
                        />
                      )}
                      <p className={hint}>No pressure on names. It just helps us stock the bar with things you like.</p>
                    </div>
                  )}
                </div>
              )}

              {cur === "arrival" && (
                <div className={card}>
                  <DayPicker label="Which day?" days={trip.arrive} value={arriveDate} onChange={(d) => set({ arrivalDate: d })} />
                  <Chips<TimeSlot> label="Roughly when?" options={SLOT_OPTIONS} value={a.arrivalSlot} onChange={(v) => set({ arrivalSlot: v })} />
                  <Chips<TravelMode>
                    label="How are you getting here?"
                    options={MODE_OPTIONS}
                    value={a.travelMode}
                    onChange={(v) =>
                      set({ travelMode: v, arrivalPoint: v !== "road" && a.arrivalPoint && POINTS[v].includes(a.arrivalPoint) ? a.arrivalPoint : null })
                    }
                  />
                  {(a.travelMode === "flight" || a.travelMode === "train") && (
                    <div className="flex flex-col gap-2">
                      <p id="point-q" className="text-[15px] font-semibold">
                        {a.travelMode === "flight" ? "Which airport?" : "Which station?"}
                      </p>
                      <div role="group" aria-labelledby="point-q" className="grid gap-2.5 sm:grid-cols-2">
                        {POINTS[a.travelMode].map((p) => (
                          <Choice key={p} on={a.arrivalPoint === p} onClick={() => set({ arrivalPoint: p })}>
                            <span className="flex flex-col gap-0.5">
                              <span>{pointLabels[p]}</span>
                              <span className="text-sm font-medium text-ink-soft">{pointNotes[p]}</span>
                            </span>
                          </Choice>
                        ))}
                      </div>
                      {a.travelMode === "flight" && (
                        <p className={hint}>Both show up as &ldquo;Goa&rdquo; when you book. GOI is the one near us.</p>
                      )}
                    </div>
                  )}
                  <p className="flex items-center gap-2 text-sm text-ink-soft">
                    <Icon name="key" size={16} />
                    {checkInNote}
                  </p>
                </div>
              )}

              {cur === "departure" && (
                <div className={card}>
                  <DayPicker
                    label="Which day?"
                    days={trip.leave}
                    value={leaveDate}
                    min={arriveDate}
                    onChange={(d) => set({ departureDate: d })}
                  />
                  <Chips<TimeSlot> label="Roughly when?" options={SLOT_OPTIONS} value={a.departureSlot} onChange={(v) => set({ departureSlot: v })} />
                  {leaveDate === trip.day3 && <p className={hint}>{checkoutNote}</p>}
                  <div className="flex flex-col gap-2">
                    <p id="ride-q" className="text-[15px] font-semibold">
                      Need a hand with the cab?
                    </p>
                    <div role="group" aria-labelledby="ride-q" className="grid gap-2.5 sm:grid-cols-3">
                      {(["sorted", "help", "share"] as RideHelp[]).map((r) => (
                        <Choice key={r} on={a.rideHelp === r} onClick={() => set({ rideHelp: r })}>
                          {r === "sorted" ? "I've got it sorted" : r === "help" ? "Help me find one" : "Happy to share one"}
                        </Choice>
                      ))}
                    </div>
                    <p className={hint}>
                      We&apos;re not running transfers, but we can point you to a cab or put you in touch with others travelling
                      around the same time.
                    </p>
                  </div>
                </div>
              )}

              {cur === "contact" && (
                <div className={card}>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="rsvp-phone" className="text-[15px] font-semibold">
                      Your WhatsApp number
                    </label>
                    <PhoneInput code={phone[0]} number={phone[1]} onChange={(c, n) => setPhone([c, n])} />
                    <p className={hint}>We&apos;ll add you to the wedding WhatsApp group for updates. No spam, promise.</p>
                  </div>
                  <Chips<Need>
                    label="Anything we should know? (optional)"
                    multi
                    options={(["stairs", "ground_floor", "medical"] as Need[]).map((v) => ({ value: v, label: needLabels[v] }))}
                    value={a.needs}
                    onChange={(v) => set({ needs: toggle(a.needs, v) })}
                  />
                  <textarea
                    aria-label="Anything else we should know"
                    className="field min-h-[5.5rem] resize-y py-3"
                    maxLength={300}
                    rows={2}
                    value={a.notes}
                    placeholder="Anything else: mobility, medical, a birthday that weekend…"
                    onChange={(e) => set({ notes: e.target.value })}
                  />
                </div>
              )}

              {cur === "review" && (
                <div className={card}>
                  <Summary a={a} name={a.name} host={host} onChange={jumpTo} />
                </div>
              )}

              {cur === "done" && <DoneCard a={a} host={host} calendarReady={calendarReady} onChange={jumpTo} />}
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-coral-200 px-4 py-3 text-[15px] font-semibold text-coral-800 lg:ml-[58px]">
              {error}
            </p>
          )}
        </div>

        {cur !== "done" && (
          <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-[#eadbc0] bg-sand-100 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:static lg:ml-[58px] lg:border-0 lg:bg-transparent lg:p-0">
            {path.length > 1 && (
              <button
                type="button"
                className="btn btn-outline shrink-0 px-5 lg:px-7"
                disabled={saving}
                onClick={() => setPath((p) => p.slice(0, -1))}
              >
                <Icon name="arrow-left" size={20} strokeWidth={2} />
                Back
              </button>
            )}
            {showContinue && (
              <button
                type="button"
                className="btn btn-primary flex-1 lg:flex-none"
                disabled={saving || !!blocked[cur]}
                onClick={onContinue}
              >
                {saving
                  ? "Saving…"
                  : cur === "review"
                    ? "Send my RSVP"
                    : revisit && sent
                      ? "Save"
                      : cur === "contact"
                        ? "Review my RSVP"
                        : "Continue"}
                {!saving && <Icon name={cur === "review" ? "send" : "arrow-right"} size={20} strokeWidth={2} />}
              </button>
            )}
            {saving && !showContinue && <span className="text-sm font-semibold text-ink-soft">Saving…</span>}
          </div>
        )}
      </section>
    </div>
  );
}

function CoupleAvatar({ size }: { size: number }) {
  return (
    <img
      src="/illustrations/couple.svg"
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-sea-200 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function DoneCard({
  a,
  host,
  calendarReady,
  onChange,
}: {
  a: Answers;
  host: string | null;
  calendarReady: boolean;
  onChange: (step: SummaryStep, editName?: boolean) => void;
}) {
  const first = a.name.split(" ")[0] || "friend";
  if (a.attending === "no") {
    return (
      <div className="card flex flex-col gap-3.5 rounded-[32px] bg-white p-7 lg:px-9 lg:py-8">
        <p className="kicker text-[28px] text-coral-800">Aww.</p>
        <h2 className="font-serif text-[34px] leading-[1.12] lg:text-[40px]">We&apos;ll miss you, {first}!</h2>
        <p className="max-w-[520px] text-lg leading-relaxed text-ink-soft">
          Thanks for letting us know. Want to leave a little note on the wall anyway? We&apos;d love that.
        </p>
        <div className="mt-1.5 flex flex-wrap gap-3">
          <Link href="/wall" className="btn btn-primary">
            Leave a note
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => onChange("attending")}>
            Change my answer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card relative flex flex-col gap-3.5 overflow-hidden rounded-[32px] bg-white p-7 lg:px-9 lg:py-8">
        <img src="/illustrations/boat.svg" alt="" className="animate-bob pointer-events-none absolute top-2.5 -right-5 hidden w-[300px] sm:block" />
        <p className="kicker text-[28px] text-sea-700">Woohoo!</p>
        <h2 className="max-w-[420px] font-serif text-[34px] leading-[1.12] lg:text-[40px]">You&apos;re on the list, {first}!</h2>
        <p className="max-w-[440px] text-lg leading-relaxed text-ink-soft">
          We just did a little happy dance. Everything&apos;s below, and you can change it any time.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-3">
          <Link href="/wall" className="btn btn-primary">
            Leave us a note on the wall
          </Link>
          {calendarReady && (
            <a href="/calendar/all" download className="btn btn-outline-sea">
              <Icon name="calendar" size={20} strokeWidth={2} />
              Add to calendar
            </a>
          )}
        </div>
      </div>
      <div className="card rounded-3xl bg-white p-5 lg:p-6">
        <Summary a={a} name={a.name} host={host} onChange={onChange} />
      </div>
    </div>
  );
}
