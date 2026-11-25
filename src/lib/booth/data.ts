import "server-only";
import { isDemo } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { demoStore, type DemoPhoto } from "@/lib/demo-store";
import { firstName } from "@/lib/format";
import type { Viewer } from "@/lib/types";
import { istMidnight, type BoothPhase } from "@/lib/booth/phase";
import { deleteFiles, photoUrls } from "@/lib/booth/storage";
import { trashInDrive } from "@/lib/google-drive";
import type { AdminPhoto, BoothStats, FeedPage, FeedPhoto, PhotoExt, TopPhoto } from "@/lib/booth/types";
import type { TopThree } from "@/lib/booth/data-types";

export const PAGE_SIZE = 24;
const DAY = 86_400_000;

/* ───────────────────────── mapping ───────────────────────── */

type PhotoRow = {
  id: string;
  guest_id: string;
  author_name: string;
  author_avatar: string | null;
  storage_key: string;
  ext: PhotoExt;
  width: number;
  height: number;
  caption: string;
  hidden: boolean;
  created_at: string;
  hearts: number;
  hearted: boolean;
  archived: boolean;
};

function toPhoto(r: PhotoRow, viewerId: string): FeedPhoto {
  return {
    id: r.id,
    guestId: r.guest_id,
    authorName: r.author_name || "A guest",
    authorAvatar: r.author_avatar,
    caption: r.caption,
    createdAt: r.created_at,
    width: r.width,
    height: r.height,
    ext: r.ext,
    ...photoUrls(r.storage_key, r.ext, r.archived),
    hearts: r.hearts,
    hearted: r.hearted,
    mine: r.guest_id === viewerId,
    hidden: r.hidden,
    archived: r.archived,
  };
}

function fail(action: string, error: { message: string } | null): never {
  throw new Error(`Couldn't ${action}: ${error?.message ?? "unknown error"}`);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Photo ids are uuids (plus "seed-N" sample photos in demo mode). */
export function isPhotoId(v: unknown): v is string {
  return typeof v === "string" && (UUID.test(v) || (isDemo && /^seed-\d{1,3}$/.test(v)));
}

/* ───────────────────────── cursor ───────────────────────── */

function encodeCursor(p: { createdAt: string; id: string }) {
  return Buffer.from(`${p.createdAt}|${p.id}`).toString("base64url");
}

function decodeCursor(cursor: string | null | undefined): { at: string; id: string } | null {
  if (!cursor) return null;
  const [at, id] = Buffer.from(cursor, "base64url").toString().split("|");
  if (!at || !id || Number.isNaN(Date.parse(at)) || !isPhotoId(id)) return null;
  return { at, id };
}

/* ───────────────────────── demo helpers ───────────────────────── */

function demoRow(p: DemoPhoto): PhotoRow {
  const store = demoStore();
  const fans = store.hearts.get(p.id);
  return {
    id: p.id,
    guest_id: p.guestId,
    author_name: p.authorName,
    author_avatar: store.guests.get(p.guestId)?.avatarUrl ?? null,
    storage_key: p.storageKey,
    ext: p.ext,
    width: p.width,
    height: p.height,
    caption: p.caption,
    hidden: p.hidden,
    created_at: p.createdAt,
    hearts: (fans?.size ?? 0) + p.baseHearts,
    hearted: false,
    archived: !!p.archivedAt,
  };
}

function demoVisible(viewerId: string) {
  return demoStore()
    .photos.filter((p) => !p.hidden || p.guestId === viewerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

function demoPhoto(p: DemoPhoto, viewerId: string) {
  const row = demoRow(p);
  row.hearted = demoStore().hearts.get(p.id)?.has(viewerId) ?? false;
  return toPhoto(row, viewerId);
}

/* ───────────────────────── feed ───────────────────────── */

export async function listFeed(
  viewer: Viewer,
  opts: { cursor?: string | null; mine?: boolean } = {},
): Promise<FeedPage> {
  const after = decodeCursor(opts.cursor);
  const me = viewer.guest.id;

  let photos: FeedPhoto[];
  if (isDemo) {
    photos = demoVisible(me)
      .filter((p) => !opts.mine || p.guestId === me)
      .filter((p) => !after || p.createdAt < after.at || (p.createdAt === after.at && p.id < after.id))
      .slice(0, PAGE_SIZE + 1)
      .map((p) => demoPhoto(p, me));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("booth_feed", {
      before_at: after?.at ?? null,
      before_id: after?.id ?? null,
      only_mine: !!opts.mine,
      lim: PAGE_SIZE + 1,
    });
    if (error) fail("load the photo booth", error);
    photos = ((data ?? []) as PhotoRow[]).map((r) => toPhoto(r, me));
  }

  const more = photos.length > PAGE_SIZE;
  const page = photos.slice(0, PAGE_SIZE);
  return { photos: page, nextCursor: more ? encodeCursor(page[page.length - 1]) : null };
}

export async function getPhoto(viewer: Viewer, id: string): Promise<FeedPhoto | null> {
  if (!isPhotoId(id)) return null;
  const me = viewer.guest.id;
  if (isDemo) {
    const p = demoStore().photos.find((x) => x.id === id && (!x.hidden || x.guestId === me));
    return p ? demoPhoto(p, me) : null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booth_photo", { pid: id });
  if (error) fail("load that photo", error);
  const row = ((data ?? []) as PhotoRow[])[0];
  return row ? toPhoto(row, me) : null;
}

/** Photos from other guests that arrived after `afterIso` (the "new photos" pill). */
export async function countNewer(viewer: Viewer, afterIso: string): Promise<number> {
  if (Number.isNaN(Date.parse(afterIso))) return 0;
  const me = viewer.guest.id;
  if (isDemo) {
    return demoStore().photos.filter((p) => !p.hidden && p.guestId !== me && p.createdAt > afterIso).length;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booth_newer", { after_at: afterIso });
  if (error) fail("check for new photos", error);
  return Number(data ?? 0);
}

export async function boothStats(viewer: Viewer): Promise<BoothStats> {
  if (isDemo) {
    const visible = demoStore().photos.filter((p) => !p.hidden);
    return { photos: visible.length, snappers: new Set(visible.map((p) => p.guestId)).size };
  }
  void viewer;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booth_stats");
  if (error) fail("count the photos", error);
  const row = ((data ?? []) as { photos: number; snappers: number }[])[0];
  return { photos: row?.photos ?? 0, snappers: row?.snappers ?? 0 };
}

/* ───────────────────────── top 3 ───────────────────────── */

export type { TopScope } from "@/lib/booth/data-types";

async function topInWindow(viewer: Viewer, from: number, to: number): Promise<FeedPhoto[]> {
  const me = viewer.guest.id;
  if (isDemo) {
    const fromIso = new Date(from).toISOString();
    const toIso = new Date(to).toISOString();
    const best = new Map<string, FeedPhoto>();
    for (const p of demoStore().photos) {
      if (p.hidden || p.createdAt < fromIso || p.createdAt >= toIso) continue;
      const photo = demoPhoto(p, me);
      if (photo.hearts < 1) continue;
      const cur = best.get(p.guestId);
      if (!cur || photo.hearts > cur.hearts || (photo.hearts === cur.hearts && photo.createdAt < cur.createdAt)) {
        best.set(p.guestId, photo);
      }
    }
    return [...best.values()]
      .sort((a, b) => b.hearts - a.hearts || a.createdAt.localeCompare(b.createdAt))
      .slice(0, 3);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booth_top3", {
    from_at: new Date(from).toISOString(),
    to_at: new Date(to).toISOString(),
  });
  if (error) fail("load the top 3", error);
  return ((data ?? []) as PhotoRow[]).map((r) => toPhoto(r, me));
}

const ranked = (photos: FeedPhoto[]): TopPhoto[] => photos.map((p, i) => ({ ...p, rank: (i + 1) as 1 | 2 | 3 }));

/**
 * While the booth is open: today's top 3 (IST day). Early in the morning, when
 * today's podium is still emptier than yesterday's, yesterday's stays up.
 * After uploads close: the top 3 of the whole weekend.
 */
export async function topThree(
  viewer: Viewer,
  phase: BoothPhase,
  now: number = Date.now(),
): Promise<TopThree> {
  if (phase === "closed") {
    return { scope: "weekend", photos: ranked(await topInWindow(viewer, 0, now + DAY)) };
  }
  const today = istMidnight(now);
  const [t, y] = await Promise.all([
    topInWindow(viewer, today, today + DAY),
    topInWindow(viewer, today - DAY, today),
  ]);
  if (t.length >= 3 || y.length <= t.length) return { scope: "today", photos: ranked(t) };
  return { scope: "yesterday", photos: ranked(y) };
}

/* ───────────────────────── sharing ───────────────────────── */

/** Bytes of every booth file (hidden ones too), for the storage safety line. */
export async function boothBytes(): Promise<number> {
  if (isDemo) return demoStore().photos.reduce((n, p) => n + p.bytes, 0);
  const { data, error } = await createAdminClient().rpc("booth_bytes");
  if (error) fail("check the booth's storage", error);
  return Number(data ?? 0);
}

/** Every photo this guest has shared (hidden ones too), for the per-guest limit. */
export async function countGuestPhotos(viewer: Viewer): Promise<number> {
  if (isDemo) return demoStore().photos.filter((p) => p.guestId === viewer.guest.id).length;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", viewer.guest.id);
  if (error) fail("count your photos", error);
  return count ?? 0;
}

export type NewPhoto = {
  id: string;
  storageKey: string;
  /** The storage service's id for the file (needed to delete it). */
  fileId: string;
  ext: PhotoExt;
  width: number;
  height: number;
  bytes: number;
  caption: string;
};

/**
 * Records a photo once its files are in storage. Only the server does this
 * (guests can't insert rows), and retrying the same photo is harmless.
 */
export async function insertPhoto(viewer: Viewer, p: NewPhoto): Promise<FeedPhoto> {
  if (isDemo) {
    const store = demoStore();
    if (!store.photos.some((x) => x.id === p.id)) {
      store.photos.push({
        ...p,
        guestId: viewer.guest.id,
        authorName: firstName(viewer.guest.displayName) || "A guest",
        archivedAt: null,
        driveFileId: null,
        purgeFileId: null,
        hidden: false,
        createdAt: new Date().toISOString(),
        baseHearts: 0,
      });
    }
  } else {
    const { error } = await createAdminClient().from("photos").insert({
      id: p.id,
      guest_id: viewer.guest.id,
      storage_key: p.storageKey,
      file_id: p.fileId,
      ext: p.ext,
      width: p.width,
      height: p.height,
      bytes: p.bytes,
      caption: p.caption,
    });
    if (error && (error as { code?: string }).code !== "23505") fail("save your photo", error);
  }
  const saved = await getPhoto(viewer, p.id);
  if (!saved) throw new Error("Couldn't find your photo after saving it.");
  return saved;
}

export async function toggleHeart(viewer: Viewer, photoId: string): Promise<{ hearts: number; hearted: boolean }> {
  if (!isPhotoId(photoId)) throw new Error("That photo doesn't exist.");
  const me = viewer.guest.id;
  if (isDemo) {
    const store = demoStore();
    const p = store.photos.find((x) => x.id === photoId && !x.hidden);
    if (!p) throw new Error("That photo doesn't exist.");
    if (p.guestId === me) throw new Error("You can't heart your own photo.");
    const fans = store.hearts.get(photoId) ?? new Set<string>();
    if (fans.has(me)) fans.delete(me);
    else fans.add(me);
    store.hearts.set(photoId, fans);
    return { hearts: fans.size + p.baseHearts, hearted: fans.has(me) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booth_toggle_heart", { pid: photoId });
  if (error) fail("heart that photo", error);
  const row = ((data ?? []) as { hearts: number; hearted: boolean }[])[0];
  return { hearts: row?.hearts ?? 0, hearted: !!row?.hearted };
}

export async function deleteOwnPhoto(viewer: Viewer, photoId: string) {
  if (!isPhotoId(photoId)) return;
  const me = viewer.guest.id;
  if (isDemo) {
    const store = demoStore();
    const p = store.photos.find((x) => x.id === photoId && x.guestId === me);
    if (!p) return;
    store.photos = store.photos.filter((x) => x !== p);
    store.hearts.delete(photoId);
    await deleteFiles([p.fileId, p.purgeFileId ?? ""]);
    if (p.driveFileId) await trashInDrive(p.driveFileId);
    return;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .delete()
    .eq("id", photoId)
    .eq("guest_id", me)
    .select("file_id, purge_file_id, drive_file_id")
    .returns<{ file_id: string; purge_file_id: string | null; drive_file_id: string | null }[]>();
  if (error) fail("delete your photo", error);
  const row = data?.[0];
  if (!row) return;
  await deleteFiles([row.file_id, row.purge_file_id ?? ""]);
  // Their archived copy goes to the couple's Drive bin too.
  if (row.drive_file_id) await trashInDrive(row.drive_file_id);
}

/* ───────────────────────── couple's controls ───────────────────────── */

function assertAdmin(viewer: Viewer | null): asserts viewer is Viewer {
  if (!viewer?.isAdmin) throw new Error("Only the couple can do that.");
}

export async function adminPhotos(viewer: Viewer | null): Promise<AdminPhoto[]> {
  assertAdmin(viewer);
  const me = viewer.guest.id;
  if (isDemo) {
    return [...demoStore().photos]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({ ...demoPhoto(p, me), bytes: p.bytes }));
  }
  type Row = Omit<PhotoRow, "author_avatar" | "hearts" | "hearted" | "archived"> & {
    bytes: number;
    archived_at: string | null;
    guests: { avatar_url: string | null } | null;
    photo_hearts: { count: number }[];
  };
  const { data, error } = await createAdminClient()
    .from("photos")
    .select(
      // photos reaches guests two ways (the author, and everyone who hearted it
      // through photo_hearts), so name the author link explicitly.
      "id, guest_id, author_name, storage_key, ext, width, height, bytes, caption, hidden, created_at, archived_at, guests!photos_guest_id_fkey(avatar_url), photo_hearts(count)",
    )
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  if (error) fail("load the photos", error);
  return (data ?? []).map((r) => ({
    ...toPhoto(
      {
        ...r,
        author_avatar: r.guests?.avatar_url ?? null,
        hearts: r.photo_hearts?.[0]?.count ?? 0,
        hearted: false,
        archived: !!r.archived_at,
      },
      me,
    ),
    bytes: r.bytes,
  }));
}

export async function setPhotoHidden(viewer: Viewer | null, photoId: string, hidden: boolean) {
  assertAdmin(viewer);
  if (!isPhotoId(photoId)) return;
  if (isDemo) {
    const p = demoStore().photos.find((x) => x.id === photoId);
    if (p) p.hidden = hidden;
    return;
  }
  const { error } = await createAdminClient().from("photos").update({ hidden }).eq("id", photoId);
  if (error) fail("update the photo", error);
}
