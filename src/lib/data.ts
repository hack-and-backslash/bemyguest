import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEMO_COOKIE, isAdminEmail, isDemo } from "@/lib/env";
import { getAccess, isWaiting, normalEmail } from "@/lib/access";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { DEMO_VIEWER_ID, demoStore } from "@/lib/demo-store";
import { firstName } from "@/lib/format";
import {
  emptyRsvp,
  type AdminRow,
  type ConfirmedGuest,
  type Guest,
  type Note,
  type NoteColor,
  type PlusOneRequest,
  type PlusOneStatus,
  type Rsvp,
  type RsvpPatch,
  type Sticker,
  type Viewer,
} from "@/lib/types";

/* ───────────────────────── row mapping ───────────────────────── */

type GuestRow = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  blocked: boolean;
  created_at: string;
};
type RsvpRow = {
  guest_id: string;
  attending: Rsvp["attending"];
  days: Rsvp["days"];
  plus_one: boolean | null;
  kids: Rsvp["kids"] | null;
  roomie: Rsvp["roomie"];
  roomie_guest_id: string | null;
  roomie_name: string;
  meal: Rsvp["meal"];
  dietary_notes: string;
  drinks: Rsvp["drinks"];
  drink_styles: Rsvp["drinkStyles"] | null;
  spirits: Rsvp["spirits"] | null;
  cocktail_favs: string;
  arrival_date: string | null;
  arrival_slot: Rsvp["arrivalSlot"];
  travel_mode: Rsvp["travelMode"];
  arrival_point: Rsvp["arrivalPoint"];
  departure_date: string | null;
  departure_slot: Rsvp["departureSlot"];
  ride_help: Rsvp["rideHelp"];
  whatsapp: string;
  needs: Rsvp["needs"] | null;
  notes: string;
  completed: boolean;
  updated_at: string;
};
type PlusOneRow = {
  guest_id: string;
  name: string;
  email: string;
  status: PlusOneStatus;
  requested_at: string;
  decided_at: string | null;
};
type NoteRow = {
  id: number;
  guest_id: string;
  author_name: string;
  body: string;
  color: NoteColor;
  sticker: Sticker;
  hidden: boolean;
  created_at: string;
};

const toGuest = (r: GuestRow): Guest => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  blocked: r.blocked,
  createdAt: r.created_at,
});

const toRsvp = (r: RsvpRow, req: PlusOneRequest | null): Rsvp => ({
  attending: r.attending,
  days: r.days,
  plusOne: r.plus_one,
  ...plusOneFields(req),
  kids: Array.isArray(r.kids) ? r.kids : [],
  roomie: r.roomie ?? null,
  roomieGuestId: r.roomie_guest_id ?? null,
  roomieName: r.roomie_name ?? "",
  // Older answers (vegan, jain) read as "not picked" now that it's veg or non-veg.
  meal: r.meal === "veg" || r.meal === "nonveg" ? r.meal : null,
  dietaryNotes: r.dietary_notes ?? "",
  drinks: r.drinks ?? null,
  drinkStyles: r.drink_styles ?? [],
  spirits: r.spirits ?? [],
  cocktailFavs: r.cocktail_favs ?? "",
  arrivalDate: r.arrival_date ?? "",
  arrivalSlot: r.arrival_slot ?? null,
  travelMode: r.travel_mode,
  arrivalPoint: r.arrival_point ?? null,
  departureDate: r.departure_date ?? "",
  departureSlot: r.departure_slot ?? null,
  rideHelp: r.ride_help ?? null,
  whatsapp: r.whatsapp ?? "",
  needs: r.needs ?? [],
  notes: r.notes ?? "",
  completed: r.completed,
  updatedAt: r.updated_at,
});

const toRequest = (r: PlusOneRow): PlusOneRequest => ({
  guestId: r.guest_id,
  name: r.name,
  email: r.email,
  status: r.status,
  requestedAt: r.requested_at,
  decidedAt: r.decided_at,
});

/** What the guest sees of their request. A decline reads as still "requested". */
const plusOneFields = (req: PlusOneRequest | null) => ({
  plusOneName: req?.name ?? "",
  plusOneEmail: req?.email ?? "",
  plusOneApproved: req?.status === "approved",
});

const toNote = (r: NoteRow): Note => ({
  id: String(r.id),
  guestId: r.guest_id,
  authorName: r.author_name,
  body: r.body,
  color: r.color,
  sticker: r.sticker,
  hidden: r.hidden,
  createdAt: r.created_at,
});

function fail(action: string, error: { message: string } | null): never {
  throw new Error(`Couldn't ${action}: ${error?.message ?? "unknown error"}`);
}

/* ───────────────────────── viewer ───────────────────────── */

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (isDemo) {
    const jar = await cookies();
    if (!jar.has(DEMO_COOKIE)) return null;
    const guest = demoStore().guests.get(DEMO_VIEWER_ID)!;
    return { guest, isAdmin: true, waiting: false };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const id = claims.sub;
  const email = typeof claims.email === "string" ? claims.email : "";
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const { data: row } = await supabase.from("guests").select("*").eq("id", id).maybeSingle<GuestRow>();

  const guest: Guest = row
    ? toGuest(row)
    : {
        id,
        email,
        displayName: String(meta.full_name ?? meta.name ?? ""),
        avatarUrl: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
        blocked: false,
        createdAt: new Date().toISOString(),
      };
  const isAdmin = isAdminEmail(email);
  const waiting = !isAdmin && isWaiting(await getAccess(), email, isAdmin);
  return { guest, isAdmin, waiting };
});

/* ───────────────────────── RSVP ───────────────────────── */

export const getRsvp = cache(async (guestId: string): Promise<Rsvp> => {
  if (isDemo) {
    const store = demoStore();
    return { ...(store.rsvps.get(guestId) ?? emptyRsvp), ...plusOneFields(store.plusOnes.get(guestId) ?? null) };
  }
  const supabase = await createClient();
  const [{ data, error }, req] = await Promise.all([
    supabase.from("rsvps").select("*").eq("guest_id", guestId).maybeSingle<RsvpRow>(),
    loadRequest(guestId),
  ]);
  if (error) fail("load your RSVP", error);
  return data ? toRsvp(data, req) : { ...emptyRsvp, ...plusOneFields(req) };
});

/* Plus-one requests live in a table only the server can read, so a guest never sees a "declined". */

async function loadRequest(guestId: string): Promise<PlusOneRequest | null> {
  if (isDemo) return demoStore().plusOnes.get(guestId) ?? null;
  const { data, error } = await createAdminClient()
    .from("plus_ones")
    .select("*")
    .eq("guest_id", guestId)
    .maybeSingle<PlusOneRow>();
  if (error) fail("load your plus-one", error);
  return data ? toRequest(data) : null;
}

/** Asking to bring someone. A different person (new email) starts a fresh request. */
async function requestPlusOne(guestId: string, name: string, email: string) {
  const current = await loadRequest(guestId);
  const now = new Date().toISOString();
  const next: PlusOneRequest =
    current && current.email === email
      ? { ...current, name }
      : { guestId, name, email, status: "pending", requestedAt: now, decidedAt: null };
  if (isDemo) {
    demoStore().plusOnes.set(guestId, next);
    return;
  }
  const { error } = await createAdminClient().from("plus_ones").upsert(
    {
      guest_id: guestId,
      name: next.name,
      email: next.email,
      status: next.status,
      requested_at: next.requestedAt,
      decided_at: next.decidedAt,
    } satisfies PlusOneRow,
    { onConflict: "guest_id" },
  );
  if (error) fail("save your plus-one", error);
}

async function withdrawPlusOne(guestId: string) {
  if (isDemo) {
    demoStore().plusOnes.delete(guestId);
    return;
  }
  const { error } = await createAdminClient().from("plus_ones").delete().eq("guest_id", guestId);
  if (error) fail("update your plus-one", error);
}

const hostName = (name: string | null | undefined) => (name?.trim() ? firstName(name) : "Your friend");

/** If this guest is someone's approved +1, that person's first name. */
export const getPlusOneOf = cache(async (viewer: Viewer): Promise<string | null> => {
  const email = normalEmail(viewer.guest.email);
  if (!email) return null;
  if (isDemo) {
    const store = demoStore();
    const req = [...store.plusOnes.values()].find((r) => r.email === email && r.status === "approved");
    return req ? hostName(store.guests.get(req.guestId)?.displayName) : null;
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plus_ones")
    .select("guest_id")
    .eq("email", email)
    .eq("status", "approved")
    .neq("guest_id", viewer.guest.id)
    .limit(1)
    .returns<{ guest_id: string }[]>();
  if (error || !data?.length) return null;
  const host = await admin.from("guests").select("display_name").eq("id", data[0].guest_id).maybeSingle<{ display_name: string }>();
  return hostName(host.data?.display_name);
});

/** Guests someone could pick to share a cottage with: signed in, not removed, not themselves. Names only. */
export async function roomieCandidates(viewer: Viewer): Promise<{ id: string; name: string; avatarUrl: string | null }[]> {
  const access = await getAccess();
  let guests: Guest[];
  if (isDemo) {
    guests = [...demoStore().guests.values()];
  } else {
    const { data, error } = await createAdminClient().from("guests").select("*").returns<GuestRow[]>();
    if (error) fail("load the guest list", error);
    guests = (data ?? []).map(toGuest);
  }
  return guests
    .filter((g) => g.id !== viewer.guest.id && !g.blocked && g.displayName.trim())
    .filter((g) => !isWaiting(access, g.email, isDemo ? g.id === DEMO_VIEWER_ID : isAdminEmail(g.email)))
    .map((g) => ({ id: g.id, name: g.displayName.trim(), avatarUrl: g.avatarUrl }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveRsvp(viewer: Viewer, patch: RsvpPatch): Promise<Rsvp> {
  const { displayName, plusOneName, plusOneEmail, ...rest } = patch;
  const me = viewer.guest.id;

  if (rest.plusOne === true) await requestPlusOne(me, plusOneName ?? "", plusOneEmail ?? "");
  if (rest.plusOne === false) await withdrawPlusOne(me);

  // A picked roommate must be a real guest; their name comes from the guest list, not the phone.
  if (rest.roomie !== undefined) {
    if (rest.roomie === "guest" && rest.roomieGuestId) {
      const pick = (await roomieCandidates(viewer)).find((c) => c.id === rest.roomieGuestId);
      if (!pick) throw new Error("We couldn't find that guest. Pick from the list, or type their name.");
      rest.roomieName = pick.name;
    } else if (rest.roomie !== "guest") {
      rest.roomieGuestId = null;
      rest.roomieName = "";
    } else {
      rest.roomieGuestId = null;
    }
  }

  if (isDemo) {
    const store = demoStore();
    if (displayName !== undefined) {
      store.guests.set(me, { ...viewer.guest, displayName });
    }
    const next: Rsvp = { ...(store.rsvps.get(me) ?? emptyRsvp), ...rest, updatedAt: new Date().toISOString() };
    store.rsvps.set(me, next);
    return { ...next, ...plusOneFields(store.plusOnes.get(me) ?? null) };
  }

  const supabase = await createClient();
  if (displayName !== undefined) {
    const { error } = await supabase.from("guests").update({ display_name: displayName }).eq("id", me);
    if (error) fail("save your name", error);
  }

  const row: Partial<RsvpRow> & { guest_id: string } = { guest_id: me };
  if (rest.attending !== undefined) row.attending = rest.attending;
  if (rest.days !== undefined) row.days = rest.days;
  if (rest.plusOne !== undefined) row.plus_one = rest.plusOne;
  if (rest.kids !== undefined) row.kids = rest.kids;
  if (rest.roomie !== undefined) row.roomie = rest.roomie;
  if (rest.roomieGuestId !== undefined) row.roomie_guest_id = rest.roomieGuestId;
  if (rest.roomieName !== undefined) row.roomie_name = rest.roomieName;
  if (rest.meal !== undefined) row.meal = rest.meal;
  if (rest.dietaryNotes !== undefined) row.dietary_notes = rest.dietaryNotes;
  if (rest.drinks !== undefined) row.drinks = rest.drinks;
  if (rest.drinkStyles !== undefined) row.drink_styles = rest.drinkStyles;
  if (rest.spirits !== undefined) row.spirits = rest.spirits;
  if (rest.cocktailFavs !== undefined) row.cocktail_favs = rest.cocktailFavs;
  if (rest.arrivalDate !== undefined) row.arrival_date = rest.arrivalDate || null;
  if (rest.arrivalSlot !== undefined) row.arrival_slot = rest.arrivalSlot;
  if (rest.travelMode !== undefined) row.travel_mode = rest.travelMode;
  if (rest.arrivalPoint !== undefined) row.arrival_point = rest.arrivalPoint;
  if (rest.departureDate !== undefined) row.departure_date = rest.departureDate || null;
  if (rest.departureSlot !== undefined) row.departure_slot = rest.departureSlot;
  if (rest.rideHelp !== undefined) row.ride_help = rest.rideHelp;
  if (rest.whatsapp !== undefined) row.whatsapp = rest.whatsapp;
  if (rest.needs !== undefined) row.needs = rest.needs;
  if (rest.notes !== undefined) row.notes = rest.notes;
  if (rest.completed !== undefined) row.completed = rest.completed;

  const [{ data, error }, req] = await Promise.all([
    supabase.from("rsvps").upsert(row, { onConflict: "guest_id" }).select("*").single<RsvpRow>(),
    loadRequest(me),
  ]);
  if (error) fail("save your RSVP", error);
  return toRsvp(data, req);
}

/* ───────────────────────── guest wall ───────────────────────── */

export async function listNotes(viewerId: string): Promise<Note[]> {
  if (isDemo) {
    return demoStore().notes.filter((n) => !n.hidden || n.guestId === viewerId);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300)
    .returns<NoteRow[]>();
  if (error) fail("load the guest wall", error);
  return (data ?? []).map(toNote);
}

export async function addNote(viewer: Viewer, input: { body: string; color: NoteColor; sticker: Sticker }) {
  if (isDemo) {
    const store = demoStore();
    store.notes.unshift({
      id: String(store.nextNoteId++),
      guestId: viewer.guest.id,
      authorName: firstName(viewer.guest.displayName),
      body: input.body,
      color: input.color,
      sticker: input.sticker,
      hidden: false,
      createdAt: new Date().toISOString(),
    });
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("notes").insert({ guest_id: viewer.guest.id, ...input });
  if (error) fail("post your note", error);
}

export async function deleteOwnNote(viewer: Viewer, noteId: string) {
  if (isDemo) {
    const store = demoStore();
    store.notes = store.notes.filter((n) => !(n.id === noteId && n.guestId === viewer.guest.id));
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", Number(noteId)).eq("guest_id", viewer.guest.id);
  if (error) fail("delete your note", error);
}

export async function getConfirmedGuests(): Promise<ConfirmedGuest[]> {
  if (isDemo) {
    const store = demoStore();
    return [...store.rsvps.entries()]
      .filter(([id, r]) => r.attending === "yes" && r.completed && !store.guests.get(id)?.blocked)
      .sort((a, b) => (b[1].updatedAt ?? "").localeCompare(a[1].updatedAt ?? ""))
      .map(([id]) => {
        const g = store.guests.get(id)!;
        return { displayName: firstName(g.displayName), avatarUrl: g.avatarUrl };
      });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirmed_guests");
  if (error) fail("load who's coming", error);
  return ((data ?? []) as { display_name: string; avatar_url: string | null }[]).map((r) => ({
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
  }));
}

/* ───────────────────────── couple's dashboard ───────────────────────── */

function assertAdmin(viewer: Viewer | null): asserts viewer is Viewer {
  if (!viewer?.isAdmin) throw new Error("Only the couple can do that.");
}

export type AdminData = { rows: AdminRow[]; notes: Note[] };

export async function getAdminData(viewer: Viewer | null): Promise<AdminData> {
  assertAdmin(viewer);
  const access = await getAccess();
  let guests: Guest[], rsvps: Map<string, Rsvp>, requests: PlusOneRequest[], notes: Note[];

  if (isDemo) {
    const store = demoStore();
    guests = [...store.guests.values()];
    rsvps = new Map(store.rsvps);
    requests = [...store.plusOnes.values()];
    notes = [...store.notes];
  } else {
    const admin = createAdminClient();
    const [g, r, p, n] = await Promise.all([
      admin.from("guests").select("*").order("created_at", { ascending: true }).returns<GuestRow[]>(),
      admin.from("rsvps").select("*").returns<RsvpRow[]>(),
      admin.from("plus_ones").select("*").returns<PlusOneRow[]>(),
      admin.from("notes").select("*").order("created_at", { ascending: false }).returns<NoteRow[]>(),
    ]);
    if (g.error) fail("load guests", g.error);
    if (r.error) fail("load RSVPs", r.error);
    if (p.error) fail("load plus-one requests", p.error);
    if (n.error) fail("load notes", n.error);
    guests = (g.data ?? []).map(toGuest);
    requests = (p.data ?? []).map(toRequest);
    const reqOf = new Map(requests.map((q) => [q.guestId, q]));
    rsvps = new Map((r.data ?? []).map((x) => [x.guest_id, toRsvp(x, reqOf.get(x.guest_id) ?? null)]));
    notes = (n.data ?? []).map(toNote);
  }

  const byGuest = new Map(requests.map((q) => [q.guestId, q]));
  const names = new Map(guests.map((g) => [g.id, g.displayName.trim() ? firstName(g.displayName) : g.email]));
  // Approved first, so a +1 asked for twice links to the yes.
  const rank = { approved: 0, pending: 1, declined: 2 } as const;
  const byEmail = new Map<string, PlusOneRequest>();
  for (const q of [...requests].sort((a, b) => rank[a.status] - rank[b.status])) {
    if (!byEmail.has(q.email)) byEmail.set(q.email, q);
  }

  const rows: AdminRow[] = guests.map((g) => {
    const request = byGuest.get(g.id) ?? null;
    const asked = byEmail.get(normalEmail(g.email));
    const rsvp = rsvps.get(g.id);
    return {
      ...g,
      rsvp: rsvp ? { ...rsvp, ...plusOneFields(request) } : null,
      request,
      plusOneOf: asked && asked.guestId !== g.id ? { guestId: asked.guestId, name: names.get(asked.guestId) ?? "", status: asked.status } : null,
      // In demo mode isAdminEmail says yes to everyone; only Sam is "the couple" there.
      waiting: isWaiting(access, g.email, isDemo ? g.id === DEMO_VIEWER_ID : isAdminEmail(g.email)),
    };
  });
  return { rows, notes };
}

export async function setPlusOneStatus(viewer: Viewer | null, guestId: string, status: PlusOneStatus) {
  assertAdmin(viewer);
  const decidedAt = status === "pending" ? null : new Date().toISOString();
  if (isDemo) {
    const req = demoStore().plusOnes.get(guestId);
    if (req) demoStore().plusOnes.set(guestId, { ...req, status, decidedAt });
    return;
  }
  const { error } = await createAdminClient().from("plus_ones").update({ status, decided_at: decidedAt }).eq("guest_id", guestId);
  if (error) fail("update the request", error);
}

export async function setNoteHidden(viewer: Viewer | null, noteId: string, hidden: boolean) {
  assertAdmin(viewer);
  if (isDemo) {
    const n = demoStore().notes.find((x) => x.id === noteId);
    if (n) n.hidden = hidden;
    return;
  }
  const { error } = await createAdminClient().from("notes").update({ hidden }).eq("id", Number(noteId));
  if (error) fail("update the note", error);
}

export async function setGuestBlocked(viewer: Viewer | null, guestId: string, blocked: boolean) {
  assertAdmin(viewer);
  if (guestId === viewer.guest.id) throw new Error("You can't remove yourself.");
  if (isDemo) {
    const store = demoStore();
    const g = store.guests.get(guestId);
    if (g) store.guests.set(guestId, { ...g, blocked });
    if (blocked) {
      store.notes.forEach((n) => n.guestId === guestId && (n.hidden = true));
      store.photos.forEach((p) => p.guestId === guestId && (p.hidden = true));
    }
    return;
  }
  const admin = createAdminClient();
  const { error } = await admin.from("guests").update({ blocked }).eq("id", guestId);
  if (error) fail("update the guest", error);
  if (blocked) {
    const res = await admin.from("notes").update({ hidden: true }).eq("guest_id", guestId);
    if (res.error) fail("hide their notes", res.error);
    const photos = await admin.from("photos").update({ hidden: true }).eq("guest_id", guestId);
    if (photos.error) fail("hide their photos", photos.error);
  }
}
