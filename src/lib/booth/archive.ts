import "server-only";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { demoStore } from "@/lib/demo-store";
import { formatStamp, formatWeekdayDate } from "@/lib/format";
import { DriveNeedsReconnect, dayFolder, uploadToDrive } from "@/lib/google-drive";
import { deleteFiles, mimeOf, readOriginal, storeLiteCopy } from "@/lib/booth/storage";
import type { PhotoExt } from "@/lib/booth/types";

/**
 * "Archive to Drive": each photo's full-size original is copied into the
 * couple's Google Drive (one folder per day), then ImageKit swaps it for a
 * lighter 1280px copy, so the booth looks the same but uses ~70% less space.
 * Runs a few photos at a time (the dashboard keeps calling until done), and is
 * safe to stop and restart at any point.
 */

type Row = {
  id: string;
  storage_key: string;
  file_id: string;
  ext: PhotoExt;
  author_name: string;
  caption: string;
  created_at: string;
  drive_file_id: string | null;
  purge_file_id: string | null;
};

export type ArchiveCounts = { archived: number; waiting: number };

const IST = 5.5 * 3_600_000;
const istDay = (iso: string) => new Date(Date.parse(iso) + IST).toISOString().slice(0, 10);
const clock = (iso: string) => new Date(Date.parse(iso) + IST).toISOString().slice(11, 16).replace(":", "");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";

function fail(action: string, error: { message: string } | null): never {
  throw new Error(`Couldn't ${action}: ${error?.message ?? "unknown error"}`);
}

/* ───────────────────────── reading & saving rows ───────────────────────── */

async function counts(): Promise<ArchiveCounts> {
  if (isDemo) {
    const real = demoStore().photos.filter((p) => p.fileId);
    const archived = real.filter((p) => p.archivedAt).length;
    return { archived, waiting: real.length - archived };
  }
  const admin = createAdminClient();
  const [a, w] = await Promise.all([
    admin.from("photos").select("id", { count: "exact", head: true }).neq("file_id", "").not("archived_at", "is", null),
    admin.from("photos").select("id", { count: "exact", head: true }).neq("file_id", "").is("archived_at", null),
  ]);
  if (a.error) fail("count archived photos", a.error);
  if (w.error) fail("count photos to archive", w.error);
  return { archived: a.count ?? 0, waiting: w.count ?? 0 };
}

export const archiveCounts = counts;

async function nextRows(limit: number): Promise<Row[]> {
  if (isDemo) {
    return demoStore()
      .photos.filter((p) => p.fileId && !p.archivedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        storage_key: p.storageKey,
        file_id: p.fileId,
        ext: p.ext,
        author_name: p.authorName,
        caption: p.caption,
        created_at: p.createdAt,
        drive_file_id: p.driveFileId,
        purge_file_id: p.purgeFileId,
      }));
  }
  const { data, error } = await createAdminClient()
    .from("photos")
    .select("id, storage_key, file_id, ext, author_name, caption, created_at, drive_file_id, purge_file_id")
    .neq("file_id", "")
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<Row[]>();
  if (error) fail("load photos to archive", error);
  return data ?? [];
}

type Change = Partial<{
  file_id: string;
  bytes: number;
  archived_at: string;
  drive_file_id: string;
  purge_file_id: string | null;
}>;

async function save(id: string, change: Change) {
  if (isDemo) {
    const p = demoStore().photos.find((x) => x.id === id);
    if (!p) return;
    if (change.file_id !== undefined) p.fileId = change.file_id;
    if (change.bytes !== undefined) p.bytes = change.bytes;
    if (change.archived_at !== undefined) p.archivedAt = change.archived_at;
    if (change.drive_file_id !== undefined) p.driveFileId = change.drive_file_id;
    if (change.purge_file_id !== undefined) p.purgeFileId = change.purge_file_id;
    return;
  }
  const { error } = await createAdminClient().from("photos").update(change).eq("id", id);
  if (error) fail("save the archive progress", error);
}

/** Originals whose deletion failed last time: try again. */
async function retryPurges() {
  let rows: { id: string; purge_file_id: string }[];
  if (isDemo) {
    rows = demoStore()
      .photos.filter((p) => p.purgeFileId)
      .map((p) => ({ id: p.id, purge_file_id: p.purgeFileId! }));
  } else {
    const { data, error } = await createAdminClient()
      .from("photos")
      .select("id, purge_file_id")
      .not("purge_file_id", "is", null)
      .limit(50)
      .returns<{ id: string; purge_file_id: string }[]>();
    if (error) fail("check old files", error);
    rows = data ?? [];
  }
  if (!rows.length) return;
  await deleteFiles(rows.map((r) => r.purge_file_id));
  for (const r of rows) await save(r.id, { purge_file_id: null });
}

/* ───────────────────────── archiving ───────────────────────── */

async function archiveOne(row: Row) {
  // 1. The original goes to Drive (skipped if an earlier run already got that far).
  let driveId = row.drive_file_id;
  if (!driveId) {
    const day = istDay(row.created_at);
    const folderId = await dayFolder(day, formatWeekdayDate(day).split(",")[0]);
    const data = await readOriginal(row.storage_key, row.ext, row.file_id);
    driveId = await uploadToDrive({
      folderId,
      name: `${clock(row.created_at)}-${slug(row.author_name)}-${row.id.slice(0, 6)}.${row.ext}`,
      mime: mimeOf(row.ext),
      data,
      description: `${row.caption ? `${row.caption} — ` : ""}${row.author_name}, ${formatStamp(row.created_at)}`,
      photoId: row.id,
    });
    await save(row.id, { drive_file_id: driveId });
  }

  // 2. ImageKit swaps the original for the lighter copy, then lets the original go.
  const lite = await storeLiteCopy(row.storage_key, row.ext);
  if (!lite) {
    await save(row.id, { archived_at: new Date().toISOString() }); // test mode: nothing to shrink
    return;
  }
  await save(row.id, {
    file_id: lite.fileId,
    bytes: lite.size,
    archived_at: new Date().toISOString(),
    purge_file_id: row.file_id,
  });
  await deleteFiles([row.file_id]);
  await save(row.id, { purge_file_id: null });
}

/** Archives the next few photos (oldest first). Call again until `waiting` is 0. */
export async function archiveBatch(limit = 4): Promise<ArchiveCounts & { done: number; errors: string[] }> {
  const errors: string[] = [];
  await retryPurges().catch((e) => errors.push(e instanceof Error ? e.message : String(e)));
  let done = 0;
  for (const row of await nextRows(limit)) {
    try {
      await archiveOne(row);
      done++;
    } catch (e) {
      if (e instanceof DriveNeedsReconnect) throw e;
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { ...(await counts()), done, errors };
}
