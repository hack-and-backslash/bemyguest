import { booth } from "@/content/booth";
import { finishUploadAction, requestUploadAction } from "@/app/(guest)/booth/actions";
import { preparePhoto, UnreadablePhotoError, type PreparedPhoto } from "@/lib/booth/compress";
import type { FeedPhoto, UploadTicket } from "@/lib/booth/types";

/**
 * The phone-side upload queue. Lives outside React so uploads keep going while
 * guests move between pages. Photos are shrunk as soon as they're picked (while
 * the guest types a caption), then sent one at a time straight to ImageKit.
 * If the signal drops, it waits and retries by itself.
 */

export type ItemStatus = "preparing" | "ready" | "uploading" | "saving" | "waiting" | "done" | "failed";

export type UploadItem = {
  key: string;
  /** Still in the share tray (not sent yet). */
  inTray: boolean;
  status: ItemStatus;
  /** 0–1 */
  progress: number;
  /** Small preview (object URL of the thumbnail) once the photo is prepared. */
  preview: string | null;
  aspect: number;
  caption: string;
  error: string | null;
  photo: FeedPhoto | null;
};

type Internal = UploadItem & {
  file: File | null;
  prepared: PreparedPhoto | null;
  ticket: UploadTicket | null;
  ticketAt: number;
  /** Set once the file is in storage (its id there). */
  fileId: string | null;
  attempts: number;
  /** Times storage turned the upload down in a row (vs. just no signal). */
  refusals: number;
};

export type UploadState = {
  items: UploadItem[];
  trayOpen: boolean;
  /** Photos left out because a batch holds at most `booth.maxPerBatch`. */
  trimmed: number;
  online: boolean;
};

let items: Internal[] = [];
let snapshot: UploadState = { items: [], trayOpen: false, trimmed: 0, online: true };
const listeners = new Set<() => void>();
const doneListeners = new Set<(photo: FeedPhoto) => void>();

function publish(extra: Partial<Omit<UploadState, "items">> = {}) {
  snapshot = {
    ...snapshot,
    ...extra,
    items: items.map(
      ({ key, inTray, status, progress, preview, aspect, caption, error, photo }): UploadItem => ({
        key,
        inTray,
        status,
        progress,
        preview,
        aspect,
        caption,
        error,
        photo,
      }),
    ),
  };
  listeners.forEach((l) => l());
}

const find = (key: string) => items.find((i) => i.key === key);

function patch(key: string, change: Partial<Internal>) {
  const it = find(key);
  if (!it) return;
  Object.assign(it, change);
  publish();
}

function drop(keys: Set<string>) {
  items = items.filter((i) => {
    if (!keys.has(i.key)) return true;
    if (i.preview) URL.revokeObjectURL(i.preview);
    return false;
  });
}

let seq = 0;
const newKey = () => `u${Date.now().toString(36)}${(seq++).toString(36)}`;

const looksLikeImage = (f: File) =>
  f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(f.name);

/* ───────────────────────── preparing ───────────────────────── */

let preparing = false;

async function prepareLoop() {
  if (preparing) return;
  preparing = true;
  try {
    for (;;) {
      const it = items.find((i) => i.status === "preparing");
      if (!it) break;
      const file = it.file;
      try {
        if (!file) throw new UnreadablePhotoError();
        const prepared = await preparePhoto(file);
        if (!find(it.key)) continue; // removed while we worked on it
        patch(it.key, {
          prepared,
          file: null,
          preview: URL.createObjectURL(prepared.thumb),
          aspect: prepared.width / prepared.height,
          status: "ready",
        });
      } catch (e) {
        patch(it.key, {
          file: null,
          status: "failed",
          error: e instanceof UnreadablePhotoError ? e.message : "Couldn't read this one.",
        });
      }
    }
  } finally {
    preparing = false;
  }
  void uploadLoop();
}

/* ───────────────────────── sending ───────────────────────── */

class Offline extends Error {}
class Refused extends Error {}

/** Sends the photo with its signed fields; resolves with storage's id for the file. */
function post(target: { url: string; fields: Record<string, string> }, blob: Blob, onProgress: (p: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const form = new FormData();
    Object.entries(target.fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", blob, `photo.${blob.type === "image/webp" ? "webp" : "jpg"}`);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", target.url);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: { fileId?: string; message?: string } = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch {
        // Not JSON (e.g. a proxy error page).
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.fileId) resolve(body.fileId);
      else if (xhr.status >= 400 && xhr.status < 500 && xhr.status !== 408 && xhr.status !== 429) {
        reject(new Refused(body.message || `Upload refused (${xhr.status})`));
      } else reject(new Offline(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = xhr.ontimeout = xhr.onabort = () => reject(new Offline("Network"));
    xhr.send(form);
  });
}

function pause(ms: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(t);
      window.removeEventListener("online", done);
      resolve();
    };
    const t = setTimeout(done, navigator.onLine ? ms : 60_000);
    window.addEventListener("online", done);
  });
}

const TICKET_FRESH_MS = 12 * 60_000;
const MAX_ATTEMPTS = 8;

async function send(key: string) {
  for (;;) {
    const it = find(key);
    if (!it || !it.prepared) return;
    const prepared = it.prepared;
    try {
      patch(key, { status: it.fileId ? "saving" : "uploading", error: null });

      if (!it.fileId && (!it.ticket || Date.now() - it.ticketAt > TICKET_FRESH_MS)) {
        const res = await requestUploadAction({ ext: prepared.ext });
        if (!res.ok) return patch(key, { status: "failed", error: res.error });
        patch(key, { ticket: res.ticket, ticketAt: Date.now() });
      }
      const ticket = find(key)?.ticket;
      if (!ticket) return;

      let fileId = find(key)?.fileId;
      if (!fileId) {
        fileId = await post(ticket.upload, prepared.full, (p) => patch(key, { progress: p * 0.95 }));
        patch(key, { fileId, refusals: 0, status: "saving", progress: 0.96 });
      }

      const res = await finishUploadAction({
        photoId: ticket.photoId,
        ext: ticket.ext,
        token: ticket.token,
        fileId,
        width: prepared.width,
        height: prepared.height,
        caption: find(key)?.caption ?? "",
      });
      if (!res.ok) {
        if (/arrive|expired/i.test(res.error)) throw new Refused(res.error);
        return patch(key, { status: "failed", error: res.error });
      }
      patch(key, { status: "done", progress: 1, photo: res.photo, prepared: null, ticket: null });
      doneListeners.forEach((l) => l(res.photo));
      return;
    } catch (e) {
      const cur = find(key);
      if (!cur) return;
      const attempts = cur.attempts + 1;
      if (attempts > MAX_ATTEMPTS) {
        return patch(key, { status: "failed", attempts, error: "Couldn't reach the booth. Tap retry when you have signal." });
      }
      // A refused upload usually means the upload link went stale: get a fresh one.
      // Turned down three times in a row means something's really wrong: stop and say so.
      if (e instanceof Refused) {
        const refusals = cur.refusals + 1;
        if (refusals >= 3) return patch(key, { status: "failed", attempts, refusals, error: e.message });
        patch(key, { ticket: null, fileId: null, attempts, refusals });
      } else patch(key, { attempts });
      patch(key, { status: "waiting" });
      await pause(Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5)));
    }
  }
}

let uploading = false;

async function uploadLoop() {
  if (uploading) return;
  uploading = true;
  try {
    for (;;) {
      const next = items.find((i) => !i.inTray && i.status === "ready");
      if (!next) break;
      await send(next.key);
    }
  } finally {
    uploading = false;
  }
}

/* ───────────────────────── public API ───────────────────────── */

if (typeof window !== "undefined") {
  const sync = () => publish({ online: navigator.onLine });
  window.addEventListener("online", sync);
  window.addEventListener("offline", sync);
  snapshot = { ...snapshot, online: navigator.onLine };
}

export const uploads = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get: () => snapshot,
  /** The first render (on the server and while hydrating) has nothing in flight. */
  getServer: (): UploadState => SERVER_STATE,

  /** Called when a photo lands in the booth. */
  onDone(listener: (photo: FeedPhoto) => void) {
    doneListeners.add(listener);
    return () => {
      doneListeners.delete(listener);
    };
  },

  /** Photos picked from the camera roll go into the share tray. */
  pick(files: FileList | File[] | null) {
    const list = Array.from(files ?? []).filter(looksLikeImage);
    if (!list.length) return;
    const room = Math.max(0, booth.maxPerBatch - items.filter((i) => i.inTray).length);
    const taken = list.slice(0, room);
    items.push(
      ...taken.map(
        (file): Internal => ({
          key: newKey(),
          inTray: true,
          status: "preparing",
          progress: 0,
          preview: null,
          aspect: 0.8,
          caption: "",
          error: null,
          photo: null,
          file,
          prepared: null,
          ticket: null,
          ticketAt: 0,
          fileId: null,
          attempts: 0,
          refusals: 0,
        }),
      ),
    );
    publish({ trayOpen: true, trimmed: list.length - taken.length });
    void prepareLoop();
  },

  remove(key: string) {
    drop(new Set([key]));
    const trayOpen = items.some((i) => i.inTray) && snapshot.trayOpen;
    publish({ trayOpen, trimmed: 0 });
  },

  cancel() {
    drop(new Set(items.filter((i) => i.inTray).map((i) => i.key)));
    publish({ trayOpen: false, trimmed: 0 });
  },

  /** Sends the tray. `limit` keeps only the first few (when a guest is near their allowance). */
  share(caption: string, limit = Infinity) {
    const clean = caption.trim().slice(0, booth.captionMax);
    const usable = items.filter((i) => i.inTray && i.status !== "failed");
    drop(
      new Set([
        ...items.filter((i) => i.inTray && i.status === "failed").map((i) => i.key),
        ...usable.slice(Math.max(0, limit)).map((i) => i.key),
      ]),
    );
    items.forEach((i) => {
      if (!i.inTray) return;
      i.inTray = false;
      i.caption = clean;
    });
    publish({ trayOpen: false, trimmed: 0 });
    void prepareLoop();
    void uploadLoop();
  },

  retry(key: string) {
    const it = find(key);
    if (!it || it.status !== "failed") return;
    if (!it.prepared) return uploads.dismiss(key);
    patch(key, { status: "ready", attempts: 0, refusals: 0, error: null });
    void uploadLoop();
  },

  retryAll() {
    items.filter((i) => !i.inTray && i.status === "failed").forEach((i) => uploads.retry(i.key));
  },

  dismiss(key: string) {
    drop(new Set([key]));
    publish();
  },

  /** Clears finished and failed items (the toast's "Done"). */
  clearFinished() {
    drop(new Set(items.filter((i) => !i.inTray && (i.status === "done" || i.status === "failed")).map((i) => i.key)));
    publish();
  },
};

const SERVER_STATE: UploadState = { items: [], trayOpen: false, trimmed: 0, online: true };

/** True while photos are still on their way (used to warn before leaving the site). */
export const isBusy = (s: UploadState) =>
  s.items.some((i) => !i.inTray && i.status !== "done" && i.status !== "failed");
