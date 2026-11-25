"use client";

/* eslint-disable @next/next/no-img-element -- small avatars from Google */
import { useId, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  dayLabels,
  drinkStyleLabels,
  kidsLabel,
  mealLabels,
  needLabels,
  plusOneLabel,
  pointLabels,
  rideLabels,
  slotLabels,
  spiritLabels,
  travelLabels,
  type Kid,
  type Rsvp,
} from "@/lib/types";
import { cx } from "@/lib/ui";
import { MAX_KIDS } from "@/lib/validate";
import { CODES, fmtDay, fmtPhone } from "@/lib/rsvp-text";

/* ───────────────────────── small controls ───────────────────────── */

export function Choice({
  on,
  onClick,
  disabled,
  children,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="choice" aria-pressed={on} onClick={onClick} disabled={disabled}>
      <span className="choice-dot" />
      {children}
    </button>
  );
}

/** A row of toggle chips. `multi`: several can be on. */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  multi = false,
}: {
  label: string;
  options: { value: T; label: React.ReactNode }[];
  value: T | T[] | null;
  onChange: (v: T) => void;
  multi?: boolean;
}) {
  const id = useId();
  const isOn = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div className="flex flex-col gap-2">
      <p id={id} className="text-[15px] font-semibold">
        {label}
      </p>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="chip"
            aria-pressed={isOn(o.value)}
            onClick={() => onChange(o.value)}
            data-multi={multi || undefined}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Day chips plus "Other date", which opens a date box. */
export function DayPicker({
  label,
  days,
  value,
  onChange,
  min,
}: {
  label: string;
  days: string[];
  value: string;
  onChange: (iso: string) => void;
  min?: string;
}) {
  const shown = days.filter((d) => !min || d >= min);
  const [other, setOther] = useState(!!value && !shown.includes(value));
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <p id={id} className="text-[15px] font-semibold">
        {label}
      </p>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2.5">
        {shown.map((d) => (
          <button
            key={d}
            type="button"
            className="chip"
            aria-pressed={!other && value === d}
            onClick={() => {
              setOther(false);
              onChange(d);
            }}
          >
            {fmtDay(d)}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={other} onClick={() => setOther(true)}>
          Another day
        </button>
      </div>
      {other && (
        <input
          type="date"
          aria-label={`${label}: pick a date`}
          className="field max-w-[14rem]"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── kids ───────────────────────── */

export function KidsEditor({ kids, onChange }: { kids: Kid[]; onChange: (k: Kid[]) => void }) {
  const set = (i: number, patch: Partial<Kid>) => onChange(kids.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] font-semibold">Your kids</p>
      <ul className="flex flex-col gap-2.5">
        {kids.map((k, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              aria-label={`Kid ${i + 1}: first name`}
              className="field min-w-0 flex-1"
              placeholder="First name"
              maxLength={40}
              value={k.name}
              onChange={(e) => set(i, { name: e.target.value })}
            />
            <select
              aria-label={`Kid ${i + 1}: age`}
              className="field w-[7.5rem] shrink-0"
              value={k.age >= 0 ? String(k.age) : ""}
              onChange={(e) => set(i, { age: e.target.value === "" ? -1 : Number(e.target.value) })}
            >
              <option value="">Age</option>
              <option value="0">Under 1</option>
              {Array.from({ length: 17 }, (_, n) => n + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {kids.length > 1 && (
              <button
                type="button"
                aria-label={`Remove kid ${i + 1}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-black/5"
                onClick={() => onChange(kids.filter((_, j) => j !== i))}
              >
                <Icon name="close" size={18} strokeWidth={2} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {kids.length < MAX_KIDS && (
        <button
          type="button"
          className="-ml-2 flex min-h-11 items-center gap-1.5 self-start rounded-full px-2 font-semibold text-sea-800 hover:bg-sea-700/10"
          onClick={() => onChange([...kids, { name: "", age: -1 }])}
        >
          <Icon name="plus" size={18} strokeWidth={2} />
          Add another
        </button>
      )}
      <p className="text-sm text-ink-soft">They&apos;ll stay in your cottage with you. Ages help us plan beds and the kids&apos; menu.</p>
    </div>
  );
}

/* ───────────────────────── roommate ───────────────────────── */

export type Candidate = { id: string; name: string; avatarUrl: string | null };

/** Search the guests who've signed in, or type a name for someone who hasn't yet. */
export function RoomiePicker({
  candidates,
  guestId,
  name,
  onPick,
}: {
  candidates: Candidate[];
  guestId: string | null;
  name: string;
  onPick: (pick: { guestId: string | null; name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q ? candidates.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6) : [];
  const picked = guestId ? candidates.find((c) => c.id === guestId) : null;

  if (guestId || name) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-h-11 items-center gap-2 rounded-full bg-sea-200 py-1 pr-1 pl-1.5 font-semibold">
          {picked?.avatarUrl ? (
            <img src={picked.avatarUrl} alt="" className="size-8 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-sand-50 text-sm">{(picked?.name ?? name).charAt(0)}</span>
          )}
          {picked?.name ?? name}
          {!guestId && <span className="text-[13px] font-normal text-ink-soft">(not signed in yet)</span>}
          <button
            type="button"
            aria-label="Pick someone else"
            className="flex size-9 items-center justify-center rounded-full hover:bg-black/5"
            onClick={() => onPick({ guestId: null, name: "" })}
          >
            <Icon name="close" size={16} strokeWidth={2} />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor="roomie-search" className="text-[15px] font-semibold">
        Who?
      </label>
      <input
        id="roomie-search"
        className="field"
        placeholder="Start typing their name"
        autoComplete="off"
        maxLength={80}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {q && (
        <ul aria-label="Guests who've signed in" className="flex flex-col gap-1.5">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 text-left font-semibold hover:bg-sea-200/60"
                onClick={() => onPick({ guestId: c.id, name: c.name })}
              >
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt="" className="size-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex size-9 items-center justify-center rounded-full bg-sand-200 text-sm">{c.name.charAt(0)}</span>
                )}
                {c.name}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 text-left hover:bg-sea-200/60"
              onClick={() => onPick({ guestId: null, name: query.trim() })}
            >
              <span className="flex size-9 items-center justify-center rounded-full border-2 border-dashed border-sand-300">
                <Icon name="plus" size={16} strokeWidth={2} />
              </span>
              <span>
                {matches.length ? "Someone else: " : "They haven't signed in yet: "}
                <b>&ldquo;{query.trim()}&rdquo;</b>
              </span>
            </button>
          </li>
        </ul>
      )}
      <p className="text-sm text-ink-soft">Nice if they pick you too, but we&apos;ll sort it either way.</p>
    </div>
  );
}

/* ───────────────────────── phone ───────────────────────── */

export function PhoneInput({ code, number, onChange }: { code: string; number: string; onChange: (code: string, number: string) => void }) {
  return (
    <div className="flex gap-2">
      <select
        aria-label="Country code"
        className="field w-[6.5rem] shrink-0 truncate pr-1 pl-3"
        value={code}
        onChange={(e) => onChange(e.target.value, number)}
      >
        {CODES.map(([c, l]) => (
          <option key={c} value={c}>
            {l}
          </option>
        ))}
        <option value="other">Other…</option>
      </select>
      <input
        id="rsvp-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className="field min-w-0 flex-1"
        placeholder={code === "other" ? "+ country code and number" : code === "+91" ? "98765 43210" : "Number"}
        maxLength={20}
        value={number}
        onChange={(e) => onChange(code, e.target.value)}
      />
    </div>
  );
}

/* ───────────────────────── summary ───────────────────────── */

export type SummaryStep = "attending" | "days" | "party" | "roomie" | "food" | "drinks" | "arrival" | "departure" | "contact";

/** Every answer in one card, each with a Change button. Shared by Review and the done screen. */
export function Summary({
  a,
  name,
  host,
  onChange,
}: {
  a: Rsvp;
  name: string;
  host: string | null;
  onChange: (step: SummaryStep, editName?: boolean) => void;
}) {
  const rows: { step: SummaryStep; label: string; value: React.ReactNode; editName?: boolean }[] = [
    { step: "attending", label: "Your name", value: name || "—", editName: true },
    { step: "days", label: "Coming", value: a.days ? (a.days === "both" ? "Both days!" : dayLabels[a.days]) : "—" },
    ...(host
      ? []
      : [
          {
            step: "party" as const,
            label: "With you",
            value: [a.plusOne ? plusOneLabel(a) : null, kidsLabel(a.kids)].filter(Boolean).join(" · ") || "Just me",
          },
          {
            step: "roomie" as const,
            label: "Sharing with",
            value:
              a.roomie === "plus_one"
                ? `My +1${a.plusOneName ? `, ${a.plusOneName}` : ""}`
                : a.roomie === "guest"
                  ? a.roomieName || "Someone coming"
                  : a.roomie === "pair_me"
                    ? "Pair me up"
                    : "—",
          },
        ]),
    {
      step: "food",
      label: "Food",
      value: [a.meal && mealLabels[a.meal], a.dietaryNotes].filter(Boolean).join(" · ") || "—",
    },
    {
      step: "drinks",
      label: "Drinks",
      value:
        a.drinks === "no"
          ? "Mocktails for me"
          : a.drinks === "yes"
            ? [a.drinkStyles.map((s) => drinkStyleLabels[s]).join(", "), a.spirits.map((s) => spiritLabels[s]).join(", "), a.cocktailFavs]
                .filter(Boolean)
                .join(" · ")
            : "—",
    },
    {
      step: "arrival",
      label: "Getting here",
      value:
        [
          a.arrivalDate && fmtDay(a.arrivalDate),
          a.arrivalSlot && slotLabels[a.arrivalSlot].toLowerCase(),
          a.travelMode && (a.arrivalPoint ? `${travelLabels[a.travelMode]} to ${pointLabels[a.arrivalPoint]}` : travelLabels[a.travelMode]),
        ]
          .filter(Boolean)
          .join(" · ") || "—",
    },
    {
      step: "departure",
      label: "Heading home",
      value:
        [a.departureDate && fmtDay(a.departureDate), a.departureSlot && slotLabels[a.departureSlot].toLowerCase(), a.rideHelp && rideLabels[a.rideHelp]]
          .filter(Boolean)
          .join(" · ") || "—",
    },
    { step: "contact", label: "WhatsApp", value: a.whatsapp ? fmtPhone(a.whatsapp) : "—" },
    {
      step: "contact",
      label: "Good to know",
      value: [...a.needs.map((n) => needLabels[n]), a.notes].filter(Boolean).join(" · ") || "Nothing",
    },
  ];
  return (
    <dl className="flex flex-col divide-y divide-sand-200">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start gap-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:gap-3">
            <dt className="shrink-0 text-[13px] font-semibold text-ink-soft sm:w-36 sm:pt-0.5 sm:text-sm">{r.label}</dt>
            <dd className="min-w-0 flex-1 text-[15px] font-semibold break-words">{r.value}</dd>
          </div>
          <button
            type="button"
            className={cx("-my-1 shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-sea-800 hover:bg-sea-700/10")}
            aria-label={`Change ${r.label.toLowerCase()}`}
            onClick={() => onChange(r.step, r.editName)}
          >
            Change
          </button>
        </div>
      ))}
    </dl>
  );
}
