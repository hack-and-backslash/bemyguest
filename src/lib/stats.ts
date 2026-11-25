import { wedding } from "@/content/wedding";
import { fmtDay } from "@/lib/rsvp-text";
import {
  drinkStyleLabels,
  mealLabels,
  needLabels,
  pointLabels,
  rideLabels,
  slotLabels,
  spiritLabels,
  travelLabels,
  type AdminRow,
  type Meal,
  type PlusOneStatus,
} from "@/lib/types";

export type Status = "coming" | "declined" | "deciding" | "waiting" | "removed";

export function statusOf(row: AdminRow): Status {
  if (row.blocked) return "removed";
  if (row.waiting) return "waiting";
  if (!row.rsvp?.completed) return "deciding";
  return row.rsvp.attending === "yes" ? "coming" : "declined";
}

export const statusLabels: Record<Status, string> = {
  coming: "Coming",
  declined: "Can't make it",
  deciding: "Still deciding",
  waiting: "Not let in yet",
  removed: "Removed",
};

export const requestLabels: Record<PlusOneStatus, string> = {
  pending: "To decide",
  approved: "Approved",
  declined: "Declined",
};

/**
 * Approved +1s who haven't RSVP'd themselves yet. Until they do, they count
 * once, alongside whoever asked for them (same days, same arrival).
 */
export function awaitingPlusOne(row: AdminRow, byEmail: Map<string, AdminRow>) {
  const q = row.request;
  if (q?.status !== "approved") return false;
  const them = byEmail.get(q.email);
  if (!them) return true;
  const s = statusOf(them);
  return s === "deciding" || s === "waiting";
}

export const emailIndex = (rows: AdminRow[]) => new Map(rows.map((r) => [r.email.trim().toLowerCase(), r]));

export type Person = { id: string; name: string };

const who = (r: AdminRow): Person => ({ id: r.id, name: r.displayName || r.email });

export function computeStats(rows: AdminRow[]) {
  const coming = rows.filter((r) => statusOf(r) === "coming");
  const byEmail = emailIndex(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const expecting = (r: AdminRow) => awaitingPlusOne(r, byEmail);
  const kidsOf = (r: AdminRow) => r.rsvp?.kids.length ?? 0;
  /** Everyone travelling with this guest: them, an approved +1 who hasn't RSVP'd yet, and their kids. */
  const party = (r: AdminRow) => 1 + (expecting(r) ? 1 : 0) + kidsOf(r);
  const sum = (list: AdminRow[], f: (r: AdminRow) => number) => list.reduce((n, r) => n + f(r), 0);

  const onDay = (day: "day1" | "day2") => sum(coming.filter((r) => r.rsvp?.days === "both" || r.rsvp?.days === day), party);

  // Plates: each guest and their kids eat what they picked; a +1 who hasn't RSVP'd is "not picked yet".
  const meals = new Map<Meal | "unknown", number>();
  const addMeal = (m: Meal | null | undefined, n: number) => meals.set(m ?? "unknown", (meals.get(m ?? "unknown") ?? 0) + n);
  for (const r of coming) {
    addMeal(r.rsvp?.meal, 1 + kidsOf(r));
    if (expecting(r)) addMeal(null, 1);
  }
  const mealRows = (Object.keys(mealLabels) as Meal[]).map((m) => ({ key: m, label: mealLabels[m], count: meals.get(m) ?? 0 }));
  const mealUnknown = meals.get("unknown") ?? 0;

  // Travel, grouped by day.
  const tally = (pick: (r: AdminRow) => string | undefined, detail: (r: AdminRow) => string | null) => {
    const days = new Map<string, { people: number; bits: Map<string, number> }>();
    for (const r of coming) {
      const key = pick(r) || "unknown";
      const e = days.get(key) ?? { people: 0, bits: new Map() };
      e.people += party(r);
      const d = detail(r);
      if (d) e.bits.set(d, (e.bits.get(d) ?? 0) + party(r));
      days.set(key, e);
    }
    return [...days.entries()]
      .sort(([a], [b]) => (a === "unknown" ? 1 : b === "unknown" ? -1 : a.localeCompare(b)))
      .map(([date, v]) => ({
        date,
        label: date === "unknown" ? "Not told us yet" : fmtDay(date),
        people: v.people,
        detail: [...v.bits.entries()].map(([k, n]) => `${n} ${k}`).join(", "),
      }));
  };
  const arrivalRows = tally(
    (r) => r.rsvp?.arrivalDate,
    (r) => (r.rsvp?.arrivalPoint ? `via ${r.rsvp.arrivalPoint}` : r.rsvp?.travelMode === "road" ? "by road" : null),
  );
  const departureRows = tally(
    (r) => r.rsvp?.departureDate,
    (r) => (r.rsvp?.departureSlot ? slotLabels[r.rsvp.departureSlot].toLowerCase() : null),
  );
  const lastDay = wedding.days[wedding.days.length - 1].date;
  const lastBreakfast = sum(
    coming.filter((r) => (r.rsvp?.departureDate ?? "") >= lastDay),
    party,
  );

  const travelLine = (r: AdminRow) =>
    [
      r.rsvp?.arrivalDate && fmtDay(r.rsvp.arrivalDate),
      r.rsvp?.arrivalSlot && slotLabels[r.rsvp.arrivalSlot].toLowerCase(),
      r.rsvp?.arrivalPoint ?? (r.rsvp?.travelMode === "road" ? "by road" : null),
    ]
      .filter(Boolean)
      .join(" · ");
  const cabHelp = coming.filter((r) => r.rsvp?.rideHelp === "help").map((r) => ({ ...who(r), when: travelLine(r) }));
  // People happy to share, grouped by when and where they land.
  const shareGroups = new Map<string, { label: string; people: Person[] }>();
  for (const r of coming.filter((x) => x.rsvp?.rideHelp === "share")) {
    const key = travelLine(r) || "Not told us yet";
    const g = shareGroups.get(key) ?? { label: key, people: [] };
    g.people.push(who(r));
    shareGroups.set(key, g);
  }

  // The bar.
  const drinkers = coming.filter((r) => r.rsvp?.drinks === "yes");
  const count = <T extends string>(list: T[][], labels: Record<T, string>) =>
    (Object.keys(labels) as T[]).map((k) => ({ key: k, label: labels[k], count: list.filter((l) => l.includes(k)).length }));
  const bar = {
    drinkers: drinkers.length,
    mocktails: coming.filter((r) => r.rsvp?.drinks === "no").length,
    styles: count(drinkers.map((r) => r.rsvp!.drinkStyles), drinkStyleLabels),
    spirits: count(drinkers.map((r) => r.rsvp!.spirits), spiritLabels),
    favourites: drinkers.filter((r) => r.rsvp!.cocktailFavs).map((r) => ({ ...who(r), text: r.rsvp!.cocktailFavs })),
  };

  // Rooms: who wants to share with whom. The couple do the pairing.
  const pairs: { a: Person; b: Person; note: string }[] = [];
  const oneWay: { from: Person; to: string; theirPick: string }[] = [];
  const waitingOnPlusOne: { from: Person; plusOne: string }[] = [];
  const pool: Person[] = [];
  const notAnswered: Person[] = [];
  const paired = new Set<string>();
  for (const r of coming) {
    const x = r.rsvp!;
    if (x.roomie === "plus_one") {
      if (r.request?.status === "approved") pairs.push({ a: who(r), b: { id: "", name: r.request.name }, note: "with their +1" });
      else waitingOnPlusOne.push({ from: who(r), plusOne: r.request?.name ?? "their +1" });
    } else if (x.roomie === "guest") {
      const them = x.roomieGuestId ? byId.get(x.roomieGuestId) : undefined;
      if (them && them.rsvp?.roomie === "guest" && them.rsvp.roomieGuestId === r.id) {
        if (!paired.has(r.id)) pairs.push({ a: who(r), b: who(them), note: "picked each other" });
        paired.add(r.id).add(them.id);
      } else {
        const theirPick = !them
          ? x.roomieGuestId
            ? "not found"
            : "not signed in yet"
          : statusOf(them) !== "coming"
            ? statusLabels[statusOf(them)].toLowerCase()
            : them.rsvp?.roomie === "pair_me"
              ? "happy to be paired"
              : them.rsvp?.roomie === "guest"
                ? `picked ${them.rsvp.roomieName || "someone else"}`
                : them.rsvp?.roomie === "plus_one"
                  ? "sharing with their +1"
                  : "hasn't picked yet";
        oneWay.push({ from: who(r), to: x.roomieName || them?.displayName || "someone", theirPick });
      }
    } else if (x.roomie === "pair_me") pool.push(who(r));
    else if (!(r.plusOneOf?.status === "approved")) notAnswered.push(who(r));
  }
  const families = coming.filter((r) => kidsOf(r) > 0).map((r) => ({ ...who(r), kids: r.rsvp!.kids }));

  const needs = coming
    .filter((r) => r.rsvp!.needs.length || r.rsvp!.notes)
    .map((r) => ({ ...who(r), needs: r.rsvp!.needs.map((n) => needLabels[n]), notes: r.rsvp!.notes }));
  const whatsapp = coming.filter((r) => r.rsvp?.whatsapp).map((r) => ({ ...who(r), number: r.rsvp!.whatsapp }));

  const dietary = coming
    .filter((r) => r.rsvp?.dietaryNotes)
    .map((r) => ({ name: r.displayName || r.email, note: r.rsvp!.dietaryNotes }));
  const expected = coming.filter(expecting).length;
  const kids = sum(coming, kidsOf);

  return {
    headcount: coming.length + expected + kids,
    adults: coming.length + expected,
    kids,
    comingCount: coming.length,
    expected,
    approved: rows.filter((r) => r.request?.status === "approved").length,
    pending: rows.filter((r) => r.request?.status === "pending").length,
    declined: rows.filter((r) => statusOf(r) === "declined").length,
    deciding: rows.filter((r) => statusOf(r) === "deciding").length,
    waiting: rows.filter((r) => statusOf(r) === "waiting").length,
    removed: rows.filter((r) => statusOf(r) === "removed").length,
    day1: onDay("day1"),
    day2: onDay("day2"),
    mealRows,
    mealUnknown,
    arrivalRows,
    departureRows,
    lastBreakfast,
    cabHelp,
    shareGroups: [...shareGroups.values()],
    bar,
    rooms: { pairs, oneWay, waitingOnPlusOne, pool, notAnswered, families },
    needs,
    whatsapp,
    dietary,
  };
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: AdminRow[]) {
  const header = [
    "Name",
    "Email",
    "WhatsApp",
    "Status",
    "Days",
    "Plus-one",
    "Plus-one email",
    "Plus-one request",
    "Plus-one of",
    "Kids",
    "Roomie",
    "Meal",
    "Dietary notes",
    "Drinks",
    "Drink styles",
    "Spirits",
    "Favourite cocktails",
    "Arrival date",
    "Arrival time",
    "Arriving by",
    "Arriving at",
    "Departure date",
    "Departure time",
    "Cab",
    "Good to know",
    "Notes",
    "Signed in",
    "Last updated",
  ];
  const lines = rows.map((r) => {
    const x = r.rsvp;
    return [
      r.displayName,
      r.email,
      x?.whatsapp ?? "",
      statusLabels[statusOf(r)],
      x?.days ?? "",
      r.request?.name ?? (x?.plusOne === false ? "Just me" : ""),
      r.request?.email ?? "",
      r.request ? requestLabels[r.request.status] : "",
      r.plusOneOf?.name ?? "",
      x?.kids.map((k) => `${k.name} (${k.age})`).join("; ") ?? "",
      x?.roomie === "plus_one" ? "Their +1" : x?.roomie === "guest" ? x.roomieName : x?.roomie === "pair_me" ? "Pair me up" : "",
      x?.meal ? mealLabels[x.meal] : "",
      x?.dietaryNotes ?? "",
      x?.drinks === "yes" ? "Yes" : x?.drinks === "no" ? "Mocktails" : "",
      x?.drinkStyles.map((d) => drinkStyleLabels[d]).join("; ") ?? "",
      x?.spirits.map((d) => spiritLabels[d]).join("; ") ?? "",
      x?.cocktailFavs ?? "",
      x?.arrivalDate ?? "",
      x?.arrivalSlot ? slotLabels[x.arrivalSlot] : "",
      x?.travelMode ? travelLabels[x.travelMode] : "",
      x?.arrivalPoint ? pointLabels[x.arrivalPoint] : "",
      x?.departureDate ?? "",
      x?.departureSlot ? slotLabels[x.departureSlot] : "",
      x?.rideHelp ? rideLabels[x.rideHelp] : "",
      x?.needs.map((n) => needLabels[n]).join("; ") ?? "",
      x?.notes ?? "",
      r.createdAt,
      x?.updatedAt ?? "",
    ]
      .map(csvCell)
      .join(",");
  });
  // BOM so Excel opens the file as UTF-8.
  return "\uFEFF" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}
