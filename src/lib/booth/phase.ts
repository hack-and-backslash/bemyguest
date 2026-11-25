/**
 * Time rules, kept pure (no settings lookups) so they work anywhere. The
 * moments themselves come from Site settings (lib/controls.ts).
 *
 * Booth stages:
 * - teaser: before the booth opens (countdown page)
 * - open:   guests can share photos
 * - closed: uploads are over; the booth is the photo album
 */
export type BoothPhase = "teaser" | "open" | "closed";

export type RsvpMode = "deadline" | "closed" | "open";

export function boothPhase(times: { boothOpensAt: string; boothClosesAt: string }, now: number): BoothPhase {
  if (now < Date.parse(times.boothOpensAt)) return "teaser";
  if (now < Date.parse(times.boothClosesAt)) return "open";
  return "closed";
}

export function isBoothPhase(v: unknown): v is BoothPhase {
  return v === "teaser" || v === "open" || v === "closed";
}

/** End of the deadline day (IST), as epoch ms. */
export const deadlineEnd = (day: string) => Date.parse(`${day}T23:59:59+05:30`);

/** RSVPs close at the end of the deadline day (IST), unless the couple closed or reopened them by hand. */
export function rsvpClosed(rules: { rsvpDeadline: string | null; rsvpMode: RsvpMode }, now: number): boolean {
  if (rules.rsvpMode === "closed") return true;
  if (rules.rsvpMode === "open" || !rules.rsvpDeadline) return false;
  return now > deadlineEnd(rules.rsvpDeadline);
}

const IST = 5.5 * 3_600_000;
const DAY = 86_400_000;

/** Midnight (IST) at the start of the day containing `now`, as epoch ms. */
export function istMidnight(now: number = Date.now()): number {
  return Math.floor((now + IST) / DAY) * DAY - IST;
}

/** The current time, read once per request (kept out of components so they stay pure). */
export const nowMs = () => Date.now();
