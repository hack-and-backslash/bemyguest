export type Attending = "yes" | "no";
export type Days = "both" | "day1" | "day2";
export type Meal = "veg" | "nonveg";
export type TravelMode = "flight" | "train" | "road";
/** Where they land: Goa's two airports and two nearby stations. */
export type ArrivalPoint = "GOI" | "GOX" | "VSG" | "MAO";
export type TimeSlot = "morning" | "afternoon" | "evening" | "late";
export type RideHelp = "sorted" | "help" | "share";
/** Who they'd like to share a cottage with (cottages are for two). */
export type RoomiePref = "plus_one" | "guest" | "pair_me";
export type DrinkStyle = "cocktails" | "straight" | "beer" | "wine";
export type Spirit = "whisky" | "rum" | "vodka" | "gin" | "tequila";
export type Need = "stairs" | "ground_floor" | "medical";
export type Kid = { name: string; age: number };
export type NoteColor = "sun" | "coral" | "sea" | "sky";
export type Sticker = "none" | "heart" | "shell" | "sun";

export type Guest = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  blocked: boolean;
  createdAt: string;
};

export type Rsvp = {
  attending: Attending | null;
  days: Days | null;
  /** false: "just me". true: they've asked to bring someone (see plusOneName/Email). */
  plusOne: boolean | null;
  plusOneName: string;
  plusOneEmail: string;
  /**
   * The couple said yes. A declined request still reads as "requested" here:
   * the couple tell guests themselves, so the site never shows a "no".
   */
  plusOneApproved: boolean;
  /** Kids coming with them (they stay in the guest's cottage). */
  kids: Kid[];
  roomie: RoomiePref | null;
  /** The guest they picked to share with (when roomie is "guest" and that person has signed in). */
  roomieGuestId: string | null;
  /** That guest's name, or the name they typed if the person hasn't signed in yet. */
  roomieName: string;
  /** One choice for them and their kids, for every meal. */
  meal: Meal | null;
  dietaryNotes: string;
  drinks: "yes" | "no" | null;
  drinkStyles: DrinkStyle[];
  spirits: Spirit[];
  cocktailFavs: string;
  arrivalDate: string;
  arrivalSlot: TimeSlot | null;
  travelMode: TravelMode | null;
  arrivalPoint: ArrivalPoint | null;
  departureDate: string;
  departureSlot: TimeSlot | null;
  rideHelp: RideHelp | null;
  /** E.164, e.g. +919876543210. */
  whatsapp: string;
  needs: Need[];
  notes: string;
  completed: boolean;
  updatedAt: string | null;
};

export type RsvpPatch = Partial<Omit<Rsvp, "updatedAt" | "plusOneApproved">> & { displayName?: string };

export type PlusOneStatus = "pending" | "approved" | "declined";

/** A guest's request to bring someone, as the couple see it. */
export type PlusOneRequest = {
  guestId: string;
  name: string;
  email: string;
  status: PlusOneStatus;
  requestedAt: string;
  decidedAt: string | null;
};

export type Note = {
  id: string;
  guestId: string;
  authorName: string;
  body: string;
  color: NoteColor;
  sticker: Sticker;
  hidden: boolean;
  createdAt: string;
};

export type ConfirmedGuest = { displayName: string; avatarUrl: string | null };

export type Viewer = {
  guest: Guest;
  isAdmin: boolean;
  /** Rehearsal mode and not on the tester list: they see "almost ready" and can't change anything. */
  waiting: boolean;
};

export type AdminRow = Guest & {
  rsvp: Rsvp | null;
  /** Their own request to bring someone. */
  request: PlusOneRequest | null;
  /** Someone asked to bring them (matched by email). */
  plusOneOf: { guestId: string; name: string; status: PlusOneStatus } | null;
  waiting: boolean;
};

export const emptyRsvp: Rsvp = {
  attending: null,
  days: null,
  plusOne: null,
  plusOneName: "",
  plusOneEmail: "",
  plusOneApproved: false,
  kids: [],
  roomie: null,
  roomieGuestId: null,
  roomieName: "",
  meal: null,
  dietaryNotes: "",
  drinks: null,
  drinkStyles: [],
  spirits: [],
  cocktailFavs: "",
  arrivalDate: "",
  arrivalSlot: null,
  travelMode: null,
  arrivalPoint: null,
  departureDate: "",
  departureSlot: null,
  rideHelp: null,
  whatsapp: "",
  needs: [],
  notes: "",
  completed: false,
  updatedAt: null,
};

/** "Just me", "+1: Riya" (approved) or "+1 requested: Riya". */
export function plusOneLabel(r: Pick<Rsvp, "plusOne" | "plusOneName" | "plusOneApproved">) {
  if (!r.plusOne) return "Just me";
  return `${r.plusOneApproved ? "+1" : "+1 requested"}: ${r.plusOneName || "someone special"}`;
}

export const mealLabels: Record<Meal, string> = {
  veg: "Vegetarian",
  nonveg: "Non-vegetarian",
};

export const slotLabels: Record<TimeSlot, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  late: "Late night",
};

export const pointLabels: Record<ArrivalPoint, string> = {
  GOI: "Dabolim airport (GOI)",
  GOX: "Mopa airport (GOX)",
  VSG: "Vasco da Gama station",
  MAO: "Madgaon station",
};

export const rideLabels: Record<RideHelp, string> = {
  sorted: "Got the ride sorted",
  help: "Wants help finding a cab",
  share: "Happy to share a cab",
};

export const drinkStyleLabels: Record<DrinkStyle, string> = {
  cocktails: "Cocktails",
  straight: "Straight up",
  beer: "Beer",
  wine: "Wine",
};

export const spiritLabels: Record<Spirit, string> = {
  whisky: "Whisky",
  rum: "Rum",
  vodka: "Vodka",
  gin: "Gin",
  tequila: "Tequila",
};

export const needLabels: Record<Need, string> = {
  stairs: "Stairs are hard",
  ground_floor: "Ground floor, please",
  medical: "Medical needs",
};

/** "2 kids (4, 7)". */
export function kidsLabel(kids: Kid[]) {
  if (!kids.length) return "";
  return `${kids.length} ${kids.length === 1 ? "kid" : "kids"} (${kids.map((k) => k.age).join(", ")})`;
}

export const travelLabels: Record<TravelMode, string> = {
  flight: "Flight",
  train: "Train",
  road: "Road trip",
};

export const dayLabels: Record<Days, string> = {
  both: "Both days",
  day1: "Day 1 only",
  day2: "Day 2 only",
};
