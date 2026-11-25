import type { PhotoExt } from "@/lib/booth/types";

/**
 * Shrinks a phone photo before it leaves the phone: a 2048px copy to upload
 * (about 0.3–0.6 MB; ImageKit makes the grid thumbnails from it), plus a small
 * local preview for the share tray. WebP where the browser can make it
 * (Chrome, Android), JPEG otherwise (Safari).
 */
export type PreparedPhoto = { full: Blob; thumb: Blob; width: number; height: number; ext: PhotoExt };

const FULL_EDGE = 2048;
const THUMB_EDGE = 400; // local preview only; never uploaded
const FULL_LIMIT = 3_800_000;

export class UnreadablePhotoError extends Error {
  constructor() {
    super("Couldn't read this one. Try a JPG or a screenshot of it.");
  }
}

let webp: boolean | null = null;
function canMakeWebp() {
  if (webp === null) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    webp = c.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webp;
}

type Source = { image: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: Blob): Promise<Source> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
  } catch {
    // Older Safari: fall back to an <img>, which also applies the photo's rotation.
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new UnreadablePhotoError();
  }
  return { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

function draw(src: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UnreadablePhotoError();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, width, height);
  return canvas;
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new UnreadablePhotoError())), type, quality),
  );
}

function fit(w: number, h: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const src = await decode(file);
  if (!src.width || !src.height) {
    src.release();
    throw new UnreadablePhotoError();
  }
  const size = fit(src.width, src.height, FULL_EDGE);
  let canvas: HTMLCanvasElement;
  try {
    canvas = draw(src.image, size.width, size.height);
  } finally {
    src.release();
  }

  const ext: PhotoExt = canMakeWebp() ? "webp" : "jpg";
  const type = ext === "webp" ? "image/webp" : "image/jpeg";
  let full = await encode(canvas, type, ext === "webp" ? 0.82 : 0.85);
  if (full.size > FULL_LIMIT) full = await encode(canvas, type, 0.7);

  const t = fit(size.width, size.height, THUMB_EDGE);
  const small = draw(canvas, t.width, t.height);
  const thumb = await encode(small, type, 0.72);

  // Let the phone reclaim the pixel memory straight away.
  canvas.width = canvas.height = 0;
  small.width = small.height = 0;

  return { full, thumb, width: size.width, height: size.height, ext };
}
