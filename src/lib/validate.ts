import type { Kid, NoteColor, Rsvp, RsvpPatch, Sticker } from "@/lib/types";

const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Only the allowed values, each once, in the order given. */
const someOf = <T extends string>(v: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(v) ? allowed.filter((a) => v.includes(a)) : [];

const day = (v: unknown) => {
  const d = text(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(`${d}T12:00:00+05:30`)) ? d : "";
};

export const MAX_KIDS = 6;

function kids(v: unknown): Kid[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_KIDS).map((k) => {
    const o = (k && typeof k === "object" ? k : {}) as Record<string, unknown>;
    const age = Math.round(Number(o.age));
    return { name: text(o.name, 40), age: Number.isFinite(age) && age >= 0 && age <= 17 ? age : -1 };
  });
}

/** "+91 98765-43210" → "+919876543210"; "" if it can't be a phone number. */
export function cleanPhone(v: unknown): string {
  const raw = text(v, 30).replace(/[\s().-]/g, "");
  if (!/^\+\d{7,15}$/.test(raw)) return "";
  if (raw.startsWith("+91") && !/^\+91[6-9]\d{9}$/.test(raw)) return "";
  return raw;
}

const SLOTS = ["morning", "afternoon", "evening", "late"] as const;

/** Keeps only known RSVP fields with allowed values. Unknown keys are dropped. */
export function cleanRsvpPatch(input: unknown): RsvpPatch {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: RsvpPatch = {};
  if ("displayName" in raw) {
    const name = text(raw.displayName, 80);
    if (name) out.displayName = name;
  }
  if ("attending" in raw) out.attending = oneOf(raw.attending, ["yes", "no"] as const);
  if ("days" in raw) out.days = oneOf(raw.days, ["both", "day1", "day2"] as const);
  if ("plusOne" in raw) out.plusOne = typeof raw.plusOne === "boolean" ? raw.plusOne : null;
  if ("plusOneName" in raw) out.plusOneName = text(raw.plusOneName, 80);
  if ("plusOneEmail" in raw) out.plusOneEmail = text(raw.plusOneEmail, 254).toLowerCase();
  if ("kids" in raw) out.kids = kids(raw.kids);
  if ("roomie" in raw) out.roomie = oneOf(raw.roomie, ["plus_one", "guest", "pair_me"] as const);
  if ("roomieGuestId" in raw) {
    const id = text(raw.roomieGuestId, 64);
    out.roomieGuestId = /^[\w-]{1,64}$/.test(id) ? id : null;
  }
  if ("roomieName" in raw) out.roomieName = text(raw.roomieName, 80);
  if ("meal" in raw) out.meal = oneOf(raw.meal, ["veg", "nonveg"] as const);
  if ("dietaryNotes" in raw) out.dietaryNotes = text(raw.dietaryNotes, 200);
  if ("drinks" in raw) out.drinks = oneOf(raw.drinks, ["yes", "no"] as const);
  if ("drinkStyles" in raw) out.drinkStyles = someOf(raw.drinkStyles, ["cocktails", "straight", "beer", "wine"] as const);
  if ("spirits" in raw) out.spirits = someOf(raw.spirits, ["whisky", "rum", "vodka", "gin", "tequila"] as const);
  if ("cocktailFavs" in raw) out.cocktailFavs = text(raw.cocktailFavs, 80);
  if ("arrivalDate" in raw) out.arrivalDate = day(raw.arrivalDate);
  if ("arrivalSlot" in raw) out.arrivalSlot = oneOf(raw.arrivalSlot, SLOTS);
  if ("travelMode" in raw) out.travelMode = oneOf(raw.travelMode, ["flight", "train", "road"] as const);
  if ("arrivalPoint" in raw) out.arrivalPoint = oneOf(raw.arrivalPoint, ["GOI", "GOX", "VSG", "MAO"] as const);
  if ("departureDate" in raw) out.departureDate = day(raw.departureDate);
  if ("departureSlot" in raw) out.departureSlot = oneOf(raw.departureSlot, SLOTS);
  if ("rideHelp" in raw) out.rideHelp = oneOf(raw.rideHelp, ["sorted", "help", "share"] as const);
  if ("whatsapp" in raw) out.whatsapp = cleanPhone(raw.whatsapp);
  if ("needs" in raw) out.needs = someOf(raw.needs, ["stairs", "ground_floor", "medical"] as const);
  if ("notes" in raw) out.notes = text(raw.notes, 300);
  if ("completed" in raw) out.completed = raw.completed === true;
  return out;
}

/**
 * What's wrong with a cleaned RSVP patch, in words for the guest, or null.
 * `raw` is what was sent, to tell "left empty" from "didn't look right".
 */
export function rsvpProblem(
  patch: RsvpPatch,
  raw: unknown,
  ownEmail: string,
  saved: Pick<Rsvp, "arrivalDate" | "departureDate">,
): string | null {
  const sent = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const plus = plusOneProblem(patch, ownEmail);
  if (plus) return plus;
  if (patch.kids?.some((k) => !k.name)) return "Add each kid's first name.";
  if (patch.kids?.some((k) => k.age < 0)) return "Add each kid's age (0 to 17).";
  if (patch.roomie === "guest" && !patch.roomieGuestId && !patch.roomieName) return "Pick who you'd like to share with, or type their name.";
  if (patch.drinks === "yes" && patch.drinkStyles?.length === 0) return "Pick what you usually go for.";
  if ("whatsapp" in sent && !patch.whatsapp) {
    return text(sent.whatsapp, 30) ? "That WhatsApp number doesn't look right." : "Add your WhatsApp number, so we can send you updates.";
  }
  const arrive = patch.arrivalDate ?? saved.arrivalDate;
  const leave = patch.departureDate ?? saved.departureDate;
  if (arrive && leave && leave < arrive) {
    return "That's leaving before you arrive. Check the dates?";
  }
  return null;
}

/**
 * A +1 request needs a name and the email they'll sign in with. Returns what's
 * wrong, or null. Only checked when the guest is asking to bring someone.
 */
function plusOneProblem(patch: RsvpPatch, ownEmail: string): string | null {
  if (patch.plusOne !== true) return null;
  if (!patch.plusOneName) return "Add their name.";
  const email = patch.plusOneEmail ?? "";
  if (!email) return "Add their email, so we can send them the link.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "That email doesn't look quite right.";
  if (email === ownEmail.trim().toLowerCase()) return "That's your own email. Add theirs instead.";
  return null;
}

export const NOTE_MAX = 140;

export function cleanNote(form: FormData): { body: string; color: NoteColor; sticker: Sticker } | { error: string } {
  const body = text(form.get("body"), NOTE_MAX + 20);
  if (!body) return { error: "Write a little something first!" };
  if (body.length > NOTE_MAX) return { error: `Keep it under ${NOTE_MAX} characters.` };
  const color = oneOf(form.get("color"), ["sun", "coral", "sea", "sky"] as const) ?? "sun";
  const sticker = oneOf(form.get("sticker"), ["none", "heart", "shell", "sun"] as const) ?? "none";
  return { body, color, sticker };
}
