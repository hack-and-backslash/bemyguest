import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { booth } from "@/content/booth";
import { wedding } from "@/content/wedding";
import { getSetting, setSetting } from "@/lib/settings";
import { getClock } from "@/lib/clock";
import { rsvpClosed, type RsvpMode } from "@/lib/booth/phase";
import type { Viewer } from "@/lib/types";

/**
 * The settings the couple can change from the dashboard (Site settings).
 * Anything not set there falls back to content/wedding.ts and content/booth.ts.
 */
export type Controls = {
  /** "YYYY-MM-DD": RSVPs close at the end of this day (IST). null: no deadline. */
  rsvpDeadline: string | null;
  /** Follow the deadline, or override it: closed now / open regardless. */
  rsvpMode: RsvpMode;
  /** ISO times with +05:30. */
  boothOpensAt: string;
  boothClosesAt: string;
  boothMaxPerGuest: number;
  boothBudgetMB: number;
  /** Emergency stop for new photos (the couple can still share). */
  boothPaused: boolean;
  /** One line across the top of every guest page; "" for none. */
  banner: string;
  bannerAt: string | null;
  /** How guests reach the couple, e.g. "Amit on +91 98xxx xxxxx". */
  contact: string;
};

const KEY = "controls";
const UNLOCKED = "rsvp_unlocked";
/** Set for a moment after an unlocked guest finishes, so they see "You're on the list!" rather than "closed". */
export const JUST_FINISHED = "rsvp_finished";

export const defaultControls: Controls = {
  rsvpDeadline: wedding.rsvpDeadline,
  rsvpMode: "deadline",
  boothOpensAt: booth.opensAt,
  boothClosesAt: booth.uploadsCloseAt,
  boothMaxPerGuest: booth.maxPerGuest,
  boothBudgetMB: booth.storageBudgetMB,
  boothPaused: false,
  banner: "",
  bannerAt: null,
  contact: wedding.contact,
};

const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Read once per request. Unknown or broken values fall back to the defaults. */
export const getControls = cache(async (): Promise<Controls> => {
  const s = (await getSetting<Partial<Controls>>(KEY)) ?? {};
  const d = defaultControls;
  return {
    rsvpDeadline: s.rsvpDeadline === null || typeof s.rsvpDeadline === "string" ? s.rsvpDeadline : d.rsvpDeadline,
    rsvpMode: s.rsvpMode === "closed" || s.rsvpMode === "open" ? s.rsvpMode : "deadline",
    boothOpensAt: str(s.boothOpensAt, d.boothOpensAt),
    boothClosesAt: str(s.boothClosesAt, d.boothClosesAt),
    boothMaxPerGuest: num(s.boothMaxPerGuest, d.boothMaxPerGuest),
    boothBudgetMB: num(s.boothBudgetMB, d.boothBudgetMB),
    boothPaused: s.boothPaused === true,
    banner: str(s.banner, d.banner),
    bannerAt: typeof s.bannerAt === "string" ? s.bannerAt : null,
    contact: str(s.contact, d.contact) || d.contact,
  };
});

export async function saveControls(patch: Partial<Controls>) {
  const current = await getControls();
  await setSetting(KEY, { ...current, ...patch } satisfies Controls);
}

/* Guests let back into their RSVP after it closed. They're locked again once they finish. */

export const getUnlocked = cache(async (): Promise<string[]> => {
  const s = await getSetting<unknown>(UNLOCKED);
  return Array.isArray(s) ? s.filter((x): x is string => typeof x === "string") : [];
});

export async function setUnlocked(guestId: string, unlocked: boolean) {
  const current = await getUnlocked();
  const next = unlocked ? [...new Set([...current, guestId])] : current.filter((id) => id !== guestId);
  if (next.length !== current.length || next.some((id, i) => id !== current[i])) await setSetting(UNLOCKED, next);
}

/* RSVP gate: what this viewer sees, and whether they can still save. */

export type RsvpGate = {
  /** Show the read-only "RSVPs are closed" view (at the preview moment, if previewing). */
  closed: boolean;
  /** Saving is refused (always the real clock; the couple and unlocked guests can still save). */
  locked: boolean;
  /** The couple let this guest back in after RSVPs closed. */
  unlocked: boolean;
};

export const getRsvpGate = cache(async (viewer: Viewer): Promise<RsvpGate> => {
  const [controls, clock, unlocked, jar] = await Promise.all([getControls(), getClock(viewer), getUnlocked(), cookies()]);
  const isUnlocked = unlocked.includes(viewer.guest.id);
  const exempt = viewer.isAdmin || isUnlocked;
  const justFinished = jar.get(JUST_FINISHED)?.value === viewer.guest.id;
  return {
    // Previewing shows exactly what guests would see, even to the couple.
    closed: clock.preview ? rsvpClosed(controls, clock.now) : rsvpClosed(controls, Date.now()) && !exempt && !justFinished,
    locked: rsvpClosed(controls, Date.now()) && !exempt,
    unlocked: isUnlocked,
  };
});
