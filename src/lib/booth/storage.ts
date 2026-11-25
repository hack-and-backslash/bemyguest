import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PhotoExt } from "@/lib/booth/types";

/**
 * Where photo files live.
 *
 * - "imagekit": ImageKit.io. Phones upload straight to ImageKit with a
 *   short-lived signed token (photos never pass through the site; Vercel caps
 *   requests at 4.5 MB), and ImageKit makes the grid thumbnails on the fly.
 * - "memory": no ImageKit keys yet (local testing / demo). Files are kept in
 *   this server's memory, go through the same signed-form flow, and vanish on
 *   restart.
 */
const publicKey = process.env.IMAGEKIT_PUBLIC_KEY ?? "";
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY ?? "";
const endpoint = (process.env.IMAGEKIT_URL_ENDPOINT ?? "").replace(/\/+$/, "");
// Only overridden by tests that stand in for ImageKit.
const API_BASE = process.env.IMAGEKIT_API_BASE || "https://api.imagekit.io";
const UPLOAD_URL = process.env.IMAGEKIT_UPLOAD_URL || "https://upload.imagekit.io/api/v2/files/upload";
const SERVER_UPLOAD_URL = process.env.IMAGEKIT_SERVER_UPLOAD_URL || "https://upload.imagekit.io/api/v1/files/upload";

export const storageMode: "imagekit" | "memory" = publicKey && privateKey && endpoint ? "imagekit" : "memory";

/** Phones send a ~0.5 MB 2048px copy; anything over this is refused. */
export const MAX_BYTES = 5_000_000;

const MIME: Record<PhotoExt, string> = { webp: "image/webp", jpg: "image/jpeg" };

/** "booth/<photoId>" + ".webp" — the file's path in ImageKit (and in memory mode). */
export const filePath = (storageKey: string, ext: PhotoExt) => `${storageKey}.${ext}`;

/** Once archived to Drive, ImageKit keeps a lighter copy here: "booth/lite/<photoId>.webp". */
export const litePath = (storageKey: string, ext: PhotoExt) => filePath(storageKey.replace(/^booth\//, "booth/lite/"), ext);

/** The lighter copy kept after archiving: fits in 1280px, still sharp on any phone. */
const LITE = (ext: PhotoExt) => `tr=w-1280,h-1280,c-at_max,q-75,f-${ext === "jpg" ? "jpg" : "webp"}`;

/** Grid thumbnails are resized by ImageKit on the fly; no second upload needed. */
const THUMB = "tr=w-640,q-70";

/** Public URLs for a stored photo. Sample (demo) photos are plain files in /public. */
export function photoUrls(storageKey: string, ext: PhotoExt, archived = false) {
  if (storageKey.startsWith("seed/")) {
    const file = `/demo-booth/${storageKey.slice(5)}.jpg`;
    return { thumbUrl: file, fullUrl: file, downloadUrl: file };
  }
  if (storageMode === "imagekit") {
    const full = `${endpoint}/${archived ? litePath(storageKey, ext) : filePath(storageKey, ext)}`;
    // ImageKit serves WebP/AVIF to browsers that take it; "orig-true" is the untouched file.
    return { thumbUrl: `${full}?${THUMB}`, fullUrl: full, downloadUrl: `${full}?tr=orig-true` };
  }
  const file = `/booth/media/${filePath(storageKey, ext)}`;
  return { thumbUrl: file, fullUrl: file, downloadUrl: file };
}

/* ───────────────────────── signing ───────────────────────── */

const g = globalThis as unknown as { __boothSecret?: string; __boothFiles?: Map<string, { type: string; data: Buffer }> };

function secret() {
  const configured = process.env.BOOTH_SIGNING_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (configured) return configured;
  g.__boothSecret ??= randomBytes(32).toString("hex");
  return g.__boothSecret;
}

export function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function verify(payload: string, signature: string) {
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/* ───────────────────────── ImageKit ───────────────────────── */

const UPLOAD_WINDOW_S = 15 * 60;

const b64url = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");

/**
 * ImageKit's V2 upload token: a JWT signed with the private key. Every upload
 * field is baked in, so the phone can only upload this one file, to this one
 * path, under the size and type limits.
 */
function uploadToken(fields: Record<string, string>) {
  const iat = Math.floor(Date.now() / 1000);
  const head = b64url({ alg: "HS256", typ: "JWT", kid: publicKey });
  const body = b64url({ ...fields, iat, exp: iat + UPLOAD_WINDOW_S });
  const sig = createHmac("sha256", privateKey).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

const auth = () => `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;

/** The form the phone POSTs its photo to (fields + the file, last). */
export function uploadForm(storageKey: string, ext: PhotoExt): { url: string; fields: Record<string, string> } {
  if (storageMode === "imagekit") {
    const slash = storageKey.lastIndexOf("/");
    const fields = {
      fileName: `${storageKey.slice(slash + 1)}.${ext}`,
      folder: `/${storageKey.slice(0, slash)}`,
      useUniqueFileName: "false",
      // A retry of the same photo just replaces it.
      overwriteFile: "true",
      checks: `'file.size' < '5MB' AND 'file.mime' IN ['image/webp', 'image/jpeg']`,
    };
    return { url: UPLOAD_URL, fields: { ...fields, token: uploadToken(fields) } };
  }
  const key = filePath(storageKey, ext);
  const expires = String(Math.floor(Date.now() / 1000) + UPLOAD_WINDOW_S);
  const payload = `${key}|${MIME[ext]}|${MAX_BYTES}|${expires}`;
  return {
    url: "/booth/upload",
    fields: { key, "Content-Type": MIME[ext], max: String(MAX_BYTES), expires, signature: sign(payload) },
  };
}

export type StoredFile = { filePath: string; size: number; mime: string };

/** What storage says about an uploaded file, or null if it isn't there. */
export async function fileDetails(fileId: string): Promise<StoredFile | null> {
  if (storageMode === "imagekit") {
    const res = await fetch(`${API_BASE}/v1/files/${encodeURIComponent(fileId)}/details`, {
      headers: { Authorization: auth() },
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`The photo service didn't answer (${res.status}). Retrying…`);
    const d = (await res.json()) as { filePath?: string; size?: number; mime?: string };
    return { filePath: (d.filePath ?? "").replace(/^\/+/, ""), size: Number(d.size ?? 0), mime: d.mime ?? "" };
  }
  const f = memoryFiles().get(fileId);
  return f ? { filePath: fileId, size: f.data.length, mime: f.type } : null;
}

export const mimeOf = (ext: PhotoExt) => MIME[ext];

/** Removes files for good. Sample photos have no file id and are skipped. */
export async function deleteFiles(fileIds: string[]) {
  const ids = fileIds.filter(Boolean);
  if (!ids.length) return;
  if (storageMode === "imagekit") {
    const res = await fetch(`${API_BASE}/v1/files/batch/deleteByFileIds`, {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: ids }),
    });
    if (!res.ok && res.status !== 404) throw new Error(`Couldn't delete the photo file (${res.status}).`);
    return;
  }
  ids.forEach((id) => memoryFiles().delete(id));
}

/* ───────────────────────── archiving ───────────────────────── */

/** The original file's bytes (for copying to Drive). */
export async function readOriginal(storageKey: string, ext: PhotoExt, fileId: string): Promise<Buffer> {
  if (storageMode === "imagekit") {
    const res = await fetch(`${endpoint}/${filePath(storageKey, ext)}?tr=orig-true`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Couldn't fetch a photo from ImageKit (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }
  const f = memoryFiles().get(fileId);
  if (!f) throw new Error("That photo's file is missing.");
  return f.data;
}

/**
 * Stores the lighter copy next to the original (ImageKit makes it from the
 * original), and returns its id and size. In test mode there's nothing to
 * shrink, so it returns null and the original stays.
 */
export async function storeLiteCopy(storageKey: string, ext: PhotoExt): Promise<{ fileId: string; size: number } | null> {
  if (storageMode !== "imagekit") return null;
  const res = await fetch(`${endpoint}/${filePath(storageKey, ext)}?${LITE(ext)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't make the lighter copy (${res.status}).`);
  const data = await res.arrayBuffer();

  const path = litePath(storageKey, ext);
  const slash = path.lastIndexOf("/");
  const form = new FormData();
  form.append("file", new Blob([data], { type: MIME[ext] }), path.slice(slash + 1));
  form.append("fileName", path.slice(slash + 1));
  form.append("folder", `/${path.slice(0, slash)}`);
  form.append("useUniqueFileName", "false");
  form.append("overwriteFile", "true");
  const up = await fetch(SERVER_UPLOAD_URL, { method: "POST", headers: { Authorization: auth() }, body: form });
  if (!up.ok) throw new Error(`Couldn't store the lighter copy (${up.status}).`);
  const body = (await up.json()) as { fileId?: string; size?: number };
  if (!body.fileId) throw new Error("ImageKit didn't return the lighter copy's id.");
  return { fileId: body.fileId, size: Number(body.size ?? data.byteLength) };
}

/* ───────────────────────── memory mode ───────────────────────── */

export function memoryFiles() {
  g.__boothFiles ??= new Map();
  return g.__boothFiles;
}

/** Checks a memory-mode upload form the way ImageKit checks its token. */
export function checkMemoryUpload(fields: Record<string, string>, size: number, type: string) {
  const { key, max, expires, signature } = fields;
  const contentType = fields["Content-Type"];
  if (!key || !contentType || !max || !expires || !signature) return "Missing fields.";
  if (!verify(`${key}|${contentType}|${max}|${expires}`, signature)) return "Bad signature.";
  if (Number(expires) * 1000 < Date.now()) return "This upload link has expired.";
  if (size < 1 || size > Number(max)) return "That file is too big.";
  if (type && type !== contentType) return "Wrong file type.";
  return null;
}
