"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { booth } from "@/content/booth";
import { getViewer } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { canPreview, PREVIEW_AT } from "@/lib/clock";
import { getControls } from "@/lib/controls";
import { boothPhase, isBoothPhase } from "@/lib/booth/phase";
import { boothBytes, countGuestPhotos, deleteOwnPhoto, insertPhoto, isPhotoId, toggleHeart } from "@/lib/booth/data";
import { deleteFiles, fileDetails, filePath, MAX_BYTES, mimeOf, uploadForm } from "@/lib/booth/storage";
import { checkTicket, makeTicket } from "@/lib/booth/token";
import { momentFor } from "@/lib/booth/viewer-phase";
import type { FeedPhoto, PhotoExt, UploadTicket } from "@/lib/booth/types";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const isExt = (v: unknown): v is PhotoExt => v === "webp" || v === "jpg";

async function guest() {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Please sign in again.");
  if (viewer.guest.blocked) throw new Error("This account can't share photos.");
  if (viewer.waiting) throw new Error("The site isn't open yet.");
  return viewer;
}

/**
 * Guests share while the booth is open (and not paused); the couple, testers in
 * rehearsal and demo mode can try it any time. Uses the real clock, never a preview.
 */
async function sharer() {
  const [viewer, controls] = await Promise.all([guest(), getControls()]);
  if (controls.boothPaused && !viewer.isAdmin) throw new Error(paused);
  const phase = boothPhase(controls, Date.now());
  if (phase !== "open" && !(await canPreview(viewer))) {
    throw new Error(phase === "teaser" ? "The booth isn't open yet." : "The booth has closed for new photos.");
  }
  return { viewer, controls };
}

function message(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

const tooMany = (max: number) => `You've shared ${max} photos, the most per guest. Delete a few from Mine to share more.`;
const full = "The booth is full for now. Let the couple know and they'll make room.";
const paused = "New photos are paused for a little while. Try again soon!";

/** Step 1: where to send one photo. */
export async function requestUploadAction(input: { ext: unknown }): Promise<Result<{ ticket: UploadTicket }>> {
  try {
    if (!isExt(input?.ext)) throw new Error("That file type isn't supported.");
    const { viewer, controls } = await sharer();
    const [mine, bytes] = await Promise.all([countGuestPhotos(viewer), boothBytes()]);
    if (mine >= controls.boothMaxPerGuest) throw new Error(tooMany(controls.boothMaxPerGuest));
    if (bytes + MAX_BYTES > controls.boothBudgetMB * 1_000_000) throw new Error(full);

    const ext = input.ext;
    const photoId = randomUUID();
    const upload = uploadForm(`booth/${photoId}`, ext);
    return { ok: true, ticket: { photoId, ext, token: makeTicket(photoId, viewer.guest.id, ext), upload } };
  } catch (e) {
    return { ok: false, error: message(e, "Couldn't start the upload.") };
  }
}

const cleanCaption = (v: unknown) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, booth.captionMax);

const cleanSide = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 10000 ? n : null;
};

/** Step 2: the photo is up, so it joins the feed. Safe to retry. */
export async function finishUploadAction(input: {
  photoId: unknown;
  ext: unknown;
  token: unknown;
  fileId: unknown;
  width: unknown;
  height: unknown;
  caption: unknown;
}): Promise<Result<{ photo: FeedPhoto }>> {
  try {
    const { photoId, ext, token, fileId } = input ?? {};
    const width = cleanSide(input?.width);
    const height = cleanSide(input?.height);
    if (
      !isPhotoId(photoId) ||
      !isExt(ext) ||
      typeof token !== "string" ||
      typeof fileId !== "string" ||
      !/^[\w./-]{1,200}$/.test(fileId) ||
      !width ||
      !height
    ) {
      throw new Error("That upload didn't look right.");
    }
    const { viewer, controls } = await sharer();
    if (!checkTicket(token, photoId, viewer.guest.id, ext)) throw new Error("That upload expired. Please try again.");

    // Ask storage what actually landed: it must be this photo's file, at this photo's path.
    const storageKey = `booth/${photoId}`;
    const stored = await fileDetails(fileId);
    if (!stored || stored.filePath !== filePath(storageKey, ext)) throw new Error("The photo didn't arrive. Retrying…");
    if (stored.size > MAX_BYTES || (stored.mime && stored.mime !== mimeOf(ext))) {
      await deleteFiles([fileId]);
      throw new Error("That photo was too big or not a photo.");
    }

    if ((await countGuestPhotos(viewer)) >= controls.boothMaxPerGuest) {
      await deleteFiles([fileId]);
      throw new Error(tooMany(controls.boothMaxPerGuest));
    }

    const photo = await insertPhoto(viewer, {
      id: photoId,
      storageKey,
      ext,
      width,
      height,
      fileId,
      bytes: stored.size,
      caption: cleanCaption(input.caption),
    });
    return { ok: true, photo };
  } catch (e) {
    return { ok: false, error: message(e, "Couldn't save your photo.") };
  }
}

export async function toggleHeartAction(photoId: unknown): Promise<Result<{ hearts: number; hearted: boolean }>> {
  try {
    if (!isPhotoId(photoId)) throw new Error("That photo doesn't exist.");
    const viewer = await guest();
    return { ok: true, ...(await toggleHeart(viewer, photoId)) };
  } catch (e) {
    return { ok: false, error: message(e, "Couldn't heart that photo.") };
  }
}

export async function deletePhotoAction(photoId: unknown): Promise<Result<object>> {
  try {
    if (!isPhotoId(photoId)) throw new Error("That photo doesn't exist.");
    const viewer = await guest();
    await deleteOwnPhoto(viewer, photoId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e, "Couldn't delete that photo.") };
  }
}

/**
 * The booth bar's Before / Weekend / After: previews the whole site at a moment
 * in that stage (the stage we're really in goes back to now).
 */
export async function setBoothPreviewAction(form: FormData) {
  const viewer = await getViewer();
  if (!(await canPreview(viewer))) return;
  const phase = form.get("phase");
  if (!isBoothPhase(phase)) return;
  const controls = await getControls();
  // Demo mode normally shows the booth open, so "now" there needs a real moment too.
  const at = momentFor(phase, controls, boothPhase(controls, Date.now())) ?? (isDemo && phase !== "open" ? Date.now() : null);
  const jar = await cookies();
  if (at === null) jar.delete(PREVIEW_AT);
  else jar.set(PREVIEW_AT, String(at), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  revalidatePath("/", "layout");
}
