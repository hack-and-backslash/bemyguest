"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, isDemo } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { addNote, deleteOwnNote, getRsvp, getViewer, saveRsvp } from "@/lib/data";
import { cleanNote, cleanRsvpPatch, rsvpProblem } from "@/lib/validate";
import { getControls, getRsvpGate, JUST_FINISHED, setUnlocked } from "@/lib/controls";
import { canPreview, PREVIEW_AT } from "@/lib/clock";
import type { Rsvp } from "@/lib/types";

async function activeViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.guest.blocked) throw new Error("This account can't make changes.");
  if (viewer.waiting) throw new Error("The site isn't open yet.");
  return viewer;
}

export async function saveRsvpAction(patch: unknown): Promise<{ ok: true; rsvp: Rsvp } | { ok: false; error: string }> {
  try {
    const viewer = await activeViewer();
    const [gate, controls] = await Promise.all([getRsvpGate(viewer), getControls()]);
    if (gate.locked) {
      throw new Error(`RSVPs have closed. Message us at ${controls.contact} and we'll update it for you.`);
    }
    const clean = cleanRsvpPatch(patch);
    const problem = rsvpProblem(clean, patch, viewer.guest.email, await getRsvp(viewer.guest.id));
    if (problem) return { ok: false, error: problem };
    const rsvp = await saveRsvp(viewer, clean);
    // Let back in after RSVPs closed: locked again once they've finished.
    if (gate.unlocked && rsvp.completed && clean.completed === true) {
      await setUnlocked(viewer.guest.id, false);
      // Keep the "You're on the list!" card up rather than switching straight to "closed".
      (await cookies()).set(JUST_FINISHED, viewer.guest.id, { path: "/rsvp", maxAge: 120, httpOnly: true, sameSite: "lax" });
    }
    revalidatePath("/", "layout");
    return { ok: true, rsvp };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export type NoteFormState = { error?: string; posted?: number };

export async function postNoteAction(_prev: NoteFormState, form: FormData): Promise<NoteFormState> {
  const viewer = await activeViewer();
  const input = cleanNote(form);
  if ("error" in input) return { error: input.error };
  try {
    await addNote(viewer, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't post your note." };
  }
  revalidatePath("/", "layout");
  return { posted: Date.now() };
}

export async function deleteNoteAction(form: FormData) {
  const viewer = await activeViewer();
  const id = String(form.get("noteId") ?? "");
  if (id) await deleteOwnNote(viewer, id);
  revalidatePath("/", "layout");
}

/**
 * Preview the site at another moment ("YYYY-MM-DDTHH:mm", IST), or "now" to
 * stop. Optional `to`: a page on this site to go to afterwards.
 */
export async function setPreviewAction(form: FormData) {
  const viewer = await getViewer();
  if (!(await canPreview(viewer))) return;
  const raw = String(form.get("at") ?? "").trim();
  const at = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? Date.parse(`${raw}+05:30`) : NaN;
  const jar = await cookies();
  if (Number.isFinite(at)) jar.set(PREVIEW_AT, String(at), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  else jar.delete(PREVIEW_AT);
  revalidatePath("/", "layout");
  const to = String(form.get("to") ?? "");
  if (/^\/(?!\/)/.test(to)) redirect(to);
}

export async function signOut() {
  if (isDemo) {
    (await cookies()).delete(DEMO_COOKIE);
  } else {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
