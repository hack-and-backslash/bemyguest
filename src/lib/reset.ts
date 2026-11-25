import "server-only";
import { isDemo } from "@/lib/env";
import { getAccess } from "@/lib/access";
import { demoStore } from "@/lib/demo-store";
import { createAdminClient } from "@/lib/supabase/server";
import { deleteFiles } from "@/lib/booth/storage";
import { driveConfigured, trashInDrive } from "@/lib/google-drive";
import type { Viewer } from "@/lib/types";

export type ClearResult = { photos: number; fileErrors: number };

/**
 * Rehearsal only: deletes every RSVP, plus-one request, note, photo and heart
 * (photo files from ImageKit too; archived copies go to the Drive bin).
 * Everyone stays signed in; the tester list and settings are kept.
 */
export async function clearSiteData(viewer: Viewer | null): Promise<ClearResult> {
  if (!viewer?.isAdmin) throw new Error("Only the couple can do that.");
  if ((await getAccess()).mode !== "rehearsal") throw new Error("The site is live, so its data can't be cleared any more.");

  let files: { ik: string[]; drive: string[] };
  if (isDemo) {
    const store = demoStore();
    files = {
      ik: store.photos.flatMap((p) => [p.fileId, p.purgeFileId ?? ""]),
      drive: store.photos.map((p) => p.driveFileId ?? ""),
    };
    store.rsvps.clear();
    store.plusOnes.clear();
    store.notes = [];
    store.photos = [];
    store.hearts.clear();
  } else {
    // One transaction in the database; it hands back the files to tidy up.
    const { data, error } = await createAdminClient().rpc("clear_site_data");
    if (error) throw new Error(`Couldn't clear the data: ${error.message}`);
    const rows = (data ?? []) as { ik_file: string; ik_purge: string | null; drive_file: string | null }[];
    files = { ik: rows.flatMap((r) => [r.ik_file, r.ik_purge ?? ""]), drive: rows.map((r) => r.drive_file ?? "") };
  }

  const ik = files.ik.filter(Boolean);
  let fileErrors = 0;
  for (let i = 0; i < ik.length; i += 100) {
    const chunk = ik.slice(i, i + 100);
    try {
      await deleteFiles(chunk);
    } catch {
      fileErrors += chunk.length;
    }
  }
  if (driveConfigured) {
    for (const id of files.drive.filter(Boolean)) await trashInDrive(id);
  }
  return { photos: files.drive.length, fileErrors };
}
