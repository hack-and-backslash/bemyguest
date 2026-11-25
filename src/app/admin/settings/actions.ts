"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/data";
import { saveControls, setUnlocked, type Controls } from "@/lib/controls";
import type { RsvpMode } from "@/lib/booth/phase";

export type SettingsResult = { ok?: string; error?: string; at?: number };

const done = (ok: string): SettingsResult => {
  revalidatePath("/", "layout");
  return { ok, at: Date.now() };
};
const problem = (error: string): SettingsResult => ({ error, at: Date.now() });

async function couple() {
  const viewer = await getViewer();
  return viewer?.isAdmin ? viewer : null;
}

const text = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const BANNER_MAX = 160;

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00+05:30`));

/** "YYYY-MM-DDTHH:mm" from a datetime-local box, read as IST. */
function istTime(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const iso = `${s}:00+05:30`;
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

function whole(v: FormDataEntryValue | null, min: number, max: number): number | null {
  const n = Number(String(v ?? "").replace(/[,\s]/g, ""));
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export async function saveRsvpSettingsAction(_prev: SettingsResult, form: FormData): Promise<SettingsResult> {
  if (!(await couple())) return problem("Only the couple can do that.");
  const raw = String(form.get("deadline") ?? "").trim();
  if (raw && !isDay(raw)) return problem("Pick a deadline date, or leave it empty for none.");
  const mode = String(form.get("mode")) as RsvpMode;
  if (mode !== "deadline" && mode !== "closed" && mode !== "open") return problem("Pick how RSVPs should work.");
  await saveControls({ rsvpDeadline: raw || null, rsvpMode: mode });
  return done("Saved.");
}

export async function saveBoothSettingsAction(_prev: SettingsResult, form: FormData): Promise<SettingsResult> {
  if (!(await couple())) return problem("Only the couple can do that.");
  const opens = istTime(form.get("opens"));
  const closes = istTime(form.get("closes"));
  if (!opens || !closes) return problem("Pick both a date and a time for opening and closing.");
  if (Date.parse(closes) <= Date.parse(opens)) return problem("Uploads have to close after the booth opens.");
  const perGuest = whole(form.get("perGuest"), 1, 1000);
  if (perGuest === null) return problem("Photos per guest: a whole number from 1 to 1,000.");
  const budget = whole(form.get("budget"), 100, 100_000);
  if (budget === null) return problem("Storage safety line: a whole number of MB from 100 to 100,000.");
  await saveControls({ boothOpensAt: opens, boothClosesAt: closes, boothMaxPerGuest: perGuest, boothBudgetMB: budget });
  return done("Saved.");
}

/** The emergency stop for new photos. Plain form: also used from Booth control. */
export async function setBoothPausedAction(form: FormData) {
  if (!(await couple())) return;
  await saveControls({ boothPaused: form.get("paused") === "true" });
  revalidatePath("/", "layout");
}

export async function saveBannerAction(_prev: SettingsResult, form: FormData): Promise<SettingsResult> {
  if (!(await couple())) return problem("Only the couple can do that.");
  if (form.get("intent") === "remove") {
    await saveControls({ banner: "", bannerAt: null });
    return done("Taken down.");
  }
  const banner = text(form.get("banner"), BANNER_MAX + 1);
  if (!banner) return problem("Write the announcement first.");
  if (banner.length > BANNER_MAX) return problem(`Keep it under ${BANNER_MAX} characters.`);
  await saveControls({ banner, bannerAt: new Date().toISOString() } satisfies Partial<Controls>);
  return done("Posted. It's at the top of every page now.");
}

export async function saveContactAction(_prev: SettingsResult, form: FormData): Promise<SettingsResult> {
  if (!(await couple())) return problem("Only the couple can do that.");
  const contact = text(form.get("contact"), 81);
  if (!contact) return problem("Add how guests can reach you.");
  if (contact.length > 80) return problem("Keep it under 80 characters.");
  await saveControls({ contact });
  return done("Saved.");
}

/** Lets one guest change their RSVP after it closed (locked again once they finish), or locks them again. */
export async function setUnlockedAction(form: FormData) {
  if (!(await couple())) return;
  const guestId = String(form.get("guestId") ?? "");
  if (guestId) await setUnlocked(guestId, form.get("unlocked") === "true");
  revalidatePath("/", "layout");
}
