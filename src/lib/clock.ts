import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isDemo } from "@/lib/env";
import { getAccess } from "@/lib/access";
import type { Viewer } from "@/lib/types";

/**
 * "Preview the site as a date": the couple (and testers during rehearsal) can
 * see every date-driven part of the site (RSVPs closing, booth stages,
 * countdowns, the schedule's "happening now") as it will look at another
 * moment. View-only: saving always follows the real clock.
 */
export const PREVIEW_AT = "preview_at";

export type Clock = { now: number; preview: boolean };

export async function canPreview(viewer: Viewer | null) {
  if (!viewer || viewer.waiting || viewer.guest.blocked) return false;
  return isDemo || viewer.isAdmin || (await getAccess()).mode === "rehearsal";
}

/** The moment to show this viewer, read once per request. */
export const getClock = cache(async (viewer: Viewer | null): Promise<Clock> => {
  const real = Date.now();
  if (!(await canPreview(viewer))) return { now: real, preview: false };
  const at = Number((await cookies()).get(PREVIEW_AT)?.value);
  return Number.isFinite(at) && at > 0 ? { now: at, preview: true } : { now: real, preview: false };
});
