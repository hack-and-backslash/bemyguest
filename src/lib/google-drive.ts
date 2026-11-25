import "server-only";
import { deleteSetting, getSetting, seal, setSetting, unseal } from "@/lib/settings";
import type { DriveStatus } from "@/lib/google-drive-types";

/**
 * The couple's Google Drive, for the Photo Booth archive. Connected once from
 * Booth control with the "drive.file" permission, which only lets the site see
 * and manage the files and folders it creates there, nothing else in the Drive.
 */
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
// Only overridden by tests that stand in for Google.
const AUTH_URL = process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const REVOKE_URL = process.env.GOOGLE_REVOKE_URL || "https://oauth2.googleapis.com/revoke";
const API = process.env.GOOGLE_API_BASE || "https://www.googleapis.com";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const SETTING = "drive";
const ROOT_NAME = "Wedding Photo Booth";

export const driveConfigured = !!(CLIENT_ID && CLIENT_SECRET);

type Stored = {
  refresh: string; // sealed
  email: string;
  folderId: string | null;
  dayFolders: Record<string, string>;
  connectedAt: string;
  broken?: boolean;
};


export class DriveNeedsReconnect extends Error {
  constructor() {
    super("Google Drive needs reconnecting. Use Reconnect in Booth control.");
  }
}

export async function driveStatus(): Promise<DriveStatus> {
  if (!driveConfigured) return { state: "off" };
  const s = await getSetting<Stored>(SETTING);
  if (!s) return { state: "disconnected" };
  if (s.broken || !unseal(s.refresh)) return { state: "broken", email: s.email };
  return {
    state: "connected",
    email: s.email,
    folderUrl: s.folderId ? `https://drive.google.com/drive/folders/${s.folderId}` : null,
  };
}

/* ───────────────────────── connecting ───────────────────────── */

export function authUrl(redirectUri: string, state: string) {
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent", // always hand back a refresh token
    include_granted_scopes: "false",
    state,
  });
  return `${AUTH_URL}?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...body }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    error?: string;
  };
  return { ok: res.ok, data };
}

/** Finishes the connection after Google sends the couple back with a code. */
export async function connectDrive(code: string, redirectUri: string) {
  const { ok, data } = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!ok || !data.access_token) throw new Error("Google didn't accept the sign-in. Please try connecting again.");
  if (!data.scope?.split(" ").includes(DRIVE_SCOPE)) {
    throw new Error("Drive access wasn't ticked on Google's screen. Connect again and allow it.");
  }
  if (!data.refresh_token) throw new Error("Google didn't send a long-lived key. Please try connecting again.");

  const about = await fetch(`${API}/drive/v3/about?fields=user(emailAddress)`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
    cache: "no-store",
  });
  const who = (await about.json().catch(() => ({}))) as { user?: { emailAddress?: string } };

  const previous = await getSetting<Stored>(SETTING);
  const sameAccount = previous && previous.email === who.user?.emailAddress;
  await setSetting(SETTING, {
    refresh: seal(data.refresh_token),
    email: who.user?.emailAddress ?? "your Google account",
    // Reconnecting the same account keeps using the same folders.
    folderId: sameAccount ? previous.folderId : null,
    dayFolders: sameAccount ? previous.dayFolders : {},
    connectedAt: new Date().toISOString(),
  } satisfies Stored);
  cachedToken = { token: data.access_token, until: Date.now() + (data.expires_in ?? 3000) * 1000 - 60_000 };
}

export async function disconnectDrive() {
  const s = await getSetting<Stored>(SETTING);
  const refresh = s && unseal(s.refresh);
  if (refresh) {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(refresh)}`, { method: "POST" }).catch(() => {});
  }
  cachedToken = null;
  await deleteSetting(SETTING);
}

/* ───────────────────────── calling Drive ───────────────────────── */

let cachedToken: { token: string; until: number } | null = null;

async function load(): Promise<Stored> {
  const s = await getSetting<Stored>(SETTING);
  if (!s || s.broken) throw new DriveNeedsReconnect();
  return s;
}

async function accessToken(fresh = false) {
  if (!fresh && cachedToken && cachedToken.until > Date.now()) return cachedToken.token;
  const s = await load();
  const refresh = unseal(s.refresh);
  if (!refresh) throw new DriveNeedsReconnect();
  const { ok, data } = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  if (!ok || !data.access_token) {
    if (data.error === "invalid_grant") {
      await setSetting(SETTING, { ...s, broken: true });
      throw new DriveNeedsReconnect();
    }
    throw new Error("Google Drive didn't answer. Try again in a minute.");
  }
  cachedToken = { token: data.access_token, until: Date.now() + (data.expires_in ?? 3000) * 1000 - 60_000 };
  return cachedToken.token;
}

async function drive(path: string, init: RequestInit = {}): Promise<Response> {
  for (const fresh of [false, true]) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await accessToken(fresh)}` },
      cache: "no-store",
    });
    if (res.status !== 401) return res;
  }
  throw new DriveNeedsReconnect();
}

async function createFolder(name: string, parent: string | null) {
  const res = await drive("/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parent ? { parents: [parent] } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Couldn't make a folder in Drive (${res.status}).`);
  return ((await res.json()) as { id: string }).id;
}

async function stillThere(id: string) {
  const res = await drive(`/drive/v3/files/${encodeURIComponent(id)}?fields=id,trashed`);
  if (!res.ok) return false;
  return !((await res.json()) as { trashed?: boolean }).trashed;
}

/** The archive's folder for one day ("2027-01-30 Sat"), made the first time it's needed. */
export async function dayFolder(day: string, label: string) {
  const s = await load();
  let folderId = s.folderId;
  let dayFolders = s.dayFolders ?? {};
  if (!folderId || !(await stillThere(folderId))) {
    folderId = await createFolder(ROOT_NAME, null);
    dayFolders = {};
  }
  let id = dayFolders[day];
  if (!id || !(await stillThere(id))) {
    id = await createFolder(`${day} ${label}`, folderId);
    dayFolders = { ...dayFolders, [day]: id };
  }
  if (folderId !== s.folderId || dayFolders !== s.dayFolders) await setSetting(SETTING, { ...s, folderId, dayFolders });
  return id;
}

/** Uploads one file (a few MB at most) and returns its Drive id. */
export async function uploadToDrive(file: {
  folderId: string;
  name: string;
  mime: string;
  data: Buffer;
  description: string;
  photoId: string;
}) {
  const boundary = `booth${Date.now().toString(36)}`;
  const meta = JSON.stringify({
    name: file.name,
    parents: [file.folderId],
    description: file.description,
    appProperties: { photoId: file.photoId },
  });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${file.mime}\r\n\r\n`),
    file.data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await drive("/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Couldn't save a photo to Drive (${res.status}).`);
  return ((await res.json()) as { id: string }).id;
}

/** Moves an archived copy to Drive's bin (when a guest deletes their photo). Never throws. */
export async function trashInDrive(id: string) {
  if (!driveConfigured || !id) return;
  try {
    await drive(`/drive/v3/files/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
  } catch {
    // Drive not connected any more: the copy stays in the couple's Drive.
  }
}
