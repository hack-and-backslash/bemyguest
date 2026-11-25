import "server-only";
import { emptyRsvp, type Guest, type Note, type PlusOneRequest, type Rsvp } from "@/lib/types";
import type { PhotoExt } from "@/lib/booth/types";

export type DemoPhoto = {
  id: string;
  guestId: string;
  authorName: string;
  storageKey: string;
  /** "" for the sample photos, which are plain files in /public. */
  fileId: string;
  archivedAt: string | null;
  driveFileId: string | null;
  purgeFileId: string | null;
  ext: PhotoExt;
  width: number;
  height: number;
  bytes: number;
  caption: string;
  hidden: boolean;
  createdAt: string;
  /** Extra hearts on sample photos, so the feed looks lived-in. */
  baseHearts: number;
};

/**
 * In-memory stand-in for the database, used only in demo mode (no Supabase
 * keys). Everything resets when the server restarts.
 */
type Store = {
  guests: Map<string, Guest>;
  rsvps: Map<string, Rsvp>;
  /** Requests to bring someone, by the guest who asked. */
  plusOnes: Map<string, PlusOneRequest>;
  notes: Note[];
  nextNoteId: number;
  photos: DemoPhoto[];
  hearts: Map<string, Set<string>>;
};

export const DEMO_VIEWER_ID = "demo-sam";

/** Demo mode starts in rehearsal with the sample guests as testers (the stranger is left waiting). */
export const DEMO_TESTERS = ["priya", "leo", "meera", "arjun", "zoe", "kabir", "ananya", "rohan"].map((n) => `${n}@example.com`);

function seed(): Store {
  const now = Date.now();
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
  const guests = new Map<string, Guest>();
  const rsvps = new Map<string, Rsvp>();

  guests.set(DEMO_VIEWER_ID, {
    id: DEMO_VIEWER_ID,
    email: "sam@example.com",
    displayName: "Sam",
    avatarUrl: null,
    blocked: false,
    createdAt: iso(5),
  });

  const trip = (arrivalDate: string, arrivalSlot: Rsvp["arrivalSlot"], travelMode: Rsvp["travelMode"], arrivalPoint: Rsvp["arrivalPoint"], departureDate: string, rideHelp: Rsvp["rideHelp"]) =>
    ({ arrivalDate, arrivalSlot, travelMode, arrivalPoint, departureDate, departureSlot: "morning", rideHelp }) satisfies Partial<Rsvp>;
  const sample: [string, Partial<Rsvp>][] = [
    ["Priya", { days: "both", meal: "veg", plusOne: true, roomie: "plus_one", drinks: "yes", drinkStyles: ["cocktails", "wine"], cocktailFavs: "Espresso martini", ...trip("2027-01-30", "morning", "flight", "GOI", "2027-02-01", "share"), whatsapp: "+919800000001" }],
    ["Leo", { days: "both", meal: "nonveg", plusOne: false, roomie: "guest", roomieGuestId: "demo-kabir", roomieName: "Kabir", drinks: "yes", drinkStyles: ["straight", "beer"], spirits: ["whisky"], ...trip("2027-01-30", "morning", "flight", "GOI", "2027-02-01", "share"), whatsapp: "+447700900002" }],
    ["Meera", { days: "day2", meal: "veg", plusOne: false, roomie: "pair_me", drinks: "no", ...trip("2027-01-31", "morning", "train", "MAO", "2027-02-01", "help"), whatsapp: "+919800000003", needs: ["stairs"], notes: "Knee surgery last year, so the fewer steps the better." }],
    ["Arjun", { days: "both", meal: "nonveg", plusOne: true, roomie: "plus_one", kids: [{ name: "Ira", age: 4 }, { name: "Vir", age: 7 }], drinks: "yes", drinkStyles: ["straight"], spirits: ["rum"], ...trip("2027-01-30", "afternoon", "road", null, "2027-02-01", "sorted"), whatsapp: "+919800000004", needs: ["ground_floor"] }],
    ["Zoe", { days: "day1", meal: "nonveg", plusOne: false, roomie: "pair_me", drinks: "yes", drinkStyles: ["cocktails"], ...trip("2027-01-30", "evening", "flight", "GOX", "2027-01-31", "help"), whatsapp: "+6591234567" }],
    ["Kabir", { days: "both", meal: "veg", plusOne: false, roomie: "guest", roomieGuestId: "demo-leo", roomieName: "Leo", drinks: "yes", drinkStyles: ["beer"], dietaryNotes: "No mushrooms", ...trip("2027-01-30", "morning", "flight", "GOI", "2027-02-01", "share"), whatsapp: "+919800000006" }],
    ["Ananya", { days: "both", meal: "veg", plusOne: false, roomie: "guest", roomieName: "Tara", drinks: "no", ...trip("2027-01-29", "late", "train", "VSG", "2027-02-02", "sorted"), whatsapp: "+919800000007" }],
  ];
  sample.forEach(([name, r], i) => {
    const id = `demo-${name.toLowerCase()}`;
    guests.set(id, {
      id,
      email: `${name.toLowerCase()}@example.com`,
      displayName: name,
      avatarUrl: null,
      blocked: false,
      createdAt: iso(3000 - i * 60),
    });
    rsvps.set(id, { ...emptyRsvp, attending: "yes", completed: true, updatedAt: iso(2000 - i * 90), ...r });
  });
  // Priya's +1 was approved and has signed in, but hasn't RSVP'd yet; Arjun's is waiting.
  const plusOnes = new Map<string, PlusOneRequest>([
    ["demo-priya", { guestId: "demo-priya", name: "Rohan", email: "rohan@example.com", status: "approved", requestedAt: iso(1900), decidedAt: iso(1500) }],
    ["demo-arjun", { guestId: "demo-arjun", name: "Kavya", email: "kavya@example.com", status: "pending", requestedAt: iso(900), decidedAt: null }],
  ]);
  guests.set("demo-rohan", {
    id: "demo-rohan",
    email: "rohan@example.com",
    displayName: "Rohan",
    avatarUrl: null,
    blocked: false,
    createdAt: iso(700),
  });
  guests.set("demo-stranger", {
    id: "demo-stranger",
    email: "who.is.this@example.com",
    displayName: "Unknown Person",
    avatarUrl: null,
    blocked: false,
    createdAt: iso(400),
  });
  rsvps.set("demo-stranger", { ...emptyRsvp, attending: "no", completed: true, updatedAt: iso(390) });

  const noteSeeds: [string, string, string, Note["color"], Note["sticker"], number][] = [
    ["demo-couple", "[A] & [B]", "We can't wait to see you all by the sea!", "sea", "heart", 10],
    ["demo-priya", "Priya", "Already packed my flip-flops. And my dancing shoes.", "sun", "none", 1800],
    ["demo-leo", "Leo", "Save me a seat near the dessert table!", "coral", "sun", 1600],
    ["demo-meera", "Meera", "First trip to Goa ever. I am SO excited.", "sky", "shell", 1400],
    ["demo-arjun", "Arjun", "I'm going to cry at the vows. Consider yourselves warned.", "sun", "heart", 1200],
    ["demo-zoe", "Zoe", "Counting sleeps!", "sea", "shell", 1000],
    ["demo-kabir", "Kabir", "Who's up for a swim before breakfast?", "coral", "none", 800],
    ["demo-ananya", "Ananya", "Love you two. See you on the lawn!", "sky", "sun", 600],
  ];
  const notes: Note[] = noteSeeds
    .map(([guestId, authorName, body, color, sticker, minsAgo], i) => ({
      id: String(i + 1),
      guestId,
      authorName,
      body,
      color,
      sticker,
      hidden: false,
      createdAt: iso(minsAgo),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Sample booth photos (files in public/demo-booth). [author, file, w, h, caption, minsAgo, extra hearts, hearted by]
  const others = sample.map(([name]) => `demo-${name.toLowerCase()}`);
  const photoSeeds: [string, string, number, number, string, number, number, number][] = [
    ["demo-zoe", "moonlit", 600, 600, "Moon over Santarem", 12, 2, 3],
    ["demo-arjun", "night", 480, 600, "Lanterns are up", 26, 4, 5],
    ["demo-priya", "golden-wide", 900, 600, "Golden hour from the clifftop", 48, 9, 6],
    ["demo-leo", "sunset", 480, 600, "The sun did that on purpose", 64, 6, 5],
    [DEMO_VIEWER_ID, "golden", 480, 600, "My view right now", 90, 3, 4],
    ["demo-meera", "cove", 600, 600, "Found the steps down to the beach", 150, 1, 4],
    ["demo-priya", "dusk", 480, 600, "", 210, 0, 2],
    ["demo-kabir", "morning", 480, 600, "Early swim crew", 420, 2, 3],
    ["demo-ananya", "cottages", 640, 480, "Home for the weekend", 1500, 5, 6],
  ];
  const hearts = new Map<string, Set<string>>();
  const photos: DemoPhoto[] = photoSeeds.map(([guestId, file, width, height, caption, minsAgo, baseHearts, by], i) => {
    const id = `seed-${i + 1}`;
    const fans = [...others, DEMO_VIEWER_ID].filter((g) => g !== guestId && g !== DEMO_VIEWER_ID).slice(0, by);
    if (i === 2) fans.push(DEMO_VIEWER_ID); // Sam has already hearted one
    hearts.set(id, new Set(fans));
    return {
      id,
      guestId,
      authorName: guests.get(guestId)!.displayName,
      storageKey: `seed/${file}`,
      fileId: "",
      archivedAt: null,
      driveFileId: null,
      purgeFileId: null,
      ext: "jpg",
      width,
      height,
      bytes: 0,
      caption,
      hidden: false,
      createdAt: iso(minsAgo),
      baseHearts,
    };
  });

  return { guests, rsvps, plusOnes, notes, nextNoteId: noteSeeds.length + 1, photos, hearts };
}

const g = globalThis as unknown as { __goaDemoStore?: Store };

export function demoStore(): Store {
  // Older in-memory stores (from before the booth or plus-one requests existed) get rebuilt.
  if (!g.__goaDemoStore?.photos || !g.__goaDemoStore.plusOnes) g.__goaDemoStore = seed();
  return g.__goaDemoStore;
}
