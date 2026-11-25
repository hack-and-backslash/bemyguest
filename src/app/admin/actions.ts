"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer, setGuestBlocked, setNoteHidden, setPlusOneStatus } from "@/lib/data";
import { addTester, getAccess, goLive, removeTester } from "@/lib/access";
import { clearSiteData } from "@/lib/reset";
import { setPhotoHidden } from "@/lib/booth/data";
import { archiveBatch } from "@/lib/booth/archive";
import { disconnectDrive, DriveNeedsReconnect } from "@/lib/google-drive";

export async function toggleNoteHidden(form: FormData) {
  const viewer = await getViewer();
  await setNoteHidden(viewer, String(form.get("noteId")), form.get("hidden") === "true");
  revalidatePath("/", "layout");
}

export async function toggleGuestBlocked(form: FormData) {
  const viewer = await getViewer();
  await setGuestBlocked(viewer, String(form.get("guestId")), form.get("blocked") === "true");
  revalidatePath("/", "layout");
}

export async function togglePhotoHidden(form: FormData) {
  const viewer = await getViewer();
  await setPhotoHidden(viewer, String(form.get("photoId")), form.get("hidden") === "true");
  revalidatePath("/", "layout");
}

export type ArchiveResult =
  | { ok: true; done: number; archived: number; waiting: number; errors: string[] }
  | { ok: false; error: string; reconnect?: boolean };

/** One step of "Archive to Drive"; Booth control calls it until nothing is waiting. */
export async function archiveBatchAction(): Promise<ArchiveResult> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { ok: false, error: "Only the couple can do that." };
  try {
    return { ok: true, ...(await archiveBatch(4)) };
  } catch (e) {
    if (e instanceof DriveNeedsReconnect) return { ok: false, error: e.message, reconnect: true };
    return { ok: false, error: e instanceof Error ? e.message : "Archiving stopped." };
  }
}

export async function disconnectDriveAction() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return;
  await disconnectDrive();
  revalidatePath("/admin/booth");
}

/* ───────────────────────── rehearsal ───────────────────────── */

export type FormResult = { ok?: string; error?: string; at?: number; value?: string };

export async function addTesterAction(_prev: FormResult, form: FormData): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { error: "Only the couple can do that." };
  const problem = await addTester(form.get("email"));
  if (problem) return { error: problem, at: Date.now(), value: String(form.get("email") ?? "") };
  revalidatePath("/", "layout");
  return { ok: "Added.", at: Date.now() };
}

/** "Let in" on someone who signed in during rehearsal: adds them as a tester. */
export async function letInAction(form: FormData) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return;
  await addTester(form.get("email"));
  revalidatePath("/", "layout");
}

export async function removeTesterAction(form: FormData) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return;
  await removeTester(form.get("email"));
  revalidatePath("/", "layout");
}

function cleared(r: Awaited<ReturnType<typeof clearSiteData>>) {
  const files = r.fileErrors ? ` ${r.fileErrors} photo files couldn't be deleted from ImageKit; you can remove them from its media library.` : "";
  return `All clear: RSVPs, +1 requests, notes and ${r.photos} ${r.photos === 1 ? "photo" : "photos"} deleted.${files}`;
}

export async function clearDataAction(_prev: FormResult, form: FormData): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { error: "Only the couple can do that." };
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== "clear") {
    return { error: "Type clear to confirm.", at: Date.now() };
  }
  try {
    const result = await clearSiteData(viewer);
    revalidatePath("/", "layout");
    return { ok: cleared(result), at: Date.now() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't clear the data.", at: Date.now() };
  }
}

export async function goLiveAction(_prev: FormResult, form: FormData): Promise<FormResult> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return { error: "Only the couple can do that." };
  const q = new URLSearchParams({ flash: "live" });
  if ((await getAccess()).mode !== "live") {
    try {
      if (form.get("clear") === "on") {
        const r = await clearSiteData(viewer);
        q.set("cleared", String(r.photos));
        if (r.fileErrors) q.set("fileErrors", String(r.fileErrors));
      }
      await goLive();
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Couldn't go live.", at: Date.now() };
    }
  }
  revalidatePath("/", "layout");
  redirect(`/admin?${q}`);
}

/* ───────────────────────── plus-ones ───────────────────────── */

/** Approve or decline (silently: the guest keeps seeing "requested"). */
export async function decidePlusOneAction(form: FormData) {
  const viewer = await getViewer();
  const status = String(form.get("status"));
  if (status !== "approved" && status !== "declined" && status !== "pending") return;
  await setPlusOneStatus(viewer, String(form.get("guestId")), status);
  revalidatePath("/", "layout");
}
