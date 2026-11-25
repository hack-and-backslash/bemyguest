import "server-only";
import { sign, verify } from "@/lib/booth/storage";
import type { PhotoExt } from "@/lib/booth/types";

/**
 * An upload ticket ties a photo id to the guest who asked for it, so the
 * "done" step can't be used to claim someone else's upload.
 */
const TICKET_TTL_MS = 60 * 60 * 1000;

export function makeTicket(photoId: string, guestId: string, ext: PhotoExt) {
  const expires = Date.now() + TICKET_TTL_MS;
  const payload = `${photoId}.${guestId}.${ext}.${expires}`;
  return `${expires}.${sign(payload)}`;
}

export function checkTicket(token: string, photoId: string, guestId: string, ext: PhotoExt) {
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return verify(`${photoId}.${guestId}.${ext}.${expires}`, signature);
}
