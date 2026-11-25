import "server-only";
import { cache } from "react";
import { adminEmails, isDemo } from "@/lib/env";
import { DEMO_TESTERS } from "@/lib/demo-store";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * Who can get in. "rehearsal": only the couple (ADMIN_EMAILS) and the testers
 * they add; everyone else sees an "almost ready" page. "live": anyone with the
 * link. Going live is one-way from the dashboard.
 */
export type SiteMode = "rehearsal" | "live";
export type Access = { mode: SiteMode; testers: string[]; liveAt: string | null };

const KEY = "access";
export const MAX_TESTERS = 50;

export const normalEmail = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
export const looksLikeEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Read once per request. */
export const getAccess = cache(async (): Promise<Access> => {
  const s = (await getSetting<Partial<Access>>(KEY)) ?? (isDemo ? { testers: DEMO_TESTERS } : null);
  return {
    mode: s?.mode === "live" ? "live" : "rehearsal",
    testers: Array.isArray(s?.testers) ? s.testers.filter((t): t is string => typeof t === "string") : [],
    liveAt: typeof s?.liveAt === "string" ? s.liveAt : null,
  };
});

export function isTester(access: Access, email: string) {
  return access.testers.includes(normalEmail(email));
}

/** Not the couple, rehearsal mode, and not on the tester list. */
export function isWaiting(access: Access, email: string, isAdmin: boolean) {
  return !isAdmin && access.mode === "rehearsal" && !isTester(access, email);
}

export async function addTester(raw: unknown): Promise<string | null> {
  const email = normalEmail(raw);
  if (!looksLikeEmail(email)) return "That doesn't look like an email address.";
  if (adminEmails.includes(email)) return "That's one of you two, already in.";
  const access = await getAccess();
  if (access.testers.includes(email)) return "They're already on the list.";
  if (access.testers.length >= MAX_TESTERS) return `That's ${MAX_TESTERS} testers already. Remove someone first.`;
  await setSetting(KEY, { ...access, testers: [...access.testers, email] } satisfies Access);
  return null;
}

export async function removeTester(raw: unknown) {
  const email = normalEmail(raw);
  const access = await getAccess();
  await setSetting(KEY, { ...access, testers: access.testers.filter((t) => t !== email) } satisfies Access);
}

export async function goLive() {
  const access = await getAccess();
  if (access.mode === "live") return;
  await setSetting(KEY, { ...access, mode: "live", liveAt: new Date().toISOString() } satisfies Access);
}
