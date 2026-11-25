/**
 * Everything guests read about the wedding lives here.
 *
 * Times are ISO strings with the IST offset, e.g. "2027-01-30T16:00:00+05:30".
 * The schedule, save-the-date, calendar invites and the sky timeline all read
 * from this file, so change a time here and it updates everywhere.
 */

export type IconName =
  | "polaroid"
  | "crown"
  | "share"
  | "more"
  | "plus"
  | "wifi-off"
  | "eye"
  | "eye-off"
  | "arrow-up"
  | "lock"
  | "trash"
  | "calendar"
  | "envelope"
  | "shell"
  | "coconut"
  | "pin"
  | "camera"
  | "user"
  | "home"
  | "umbrella"
  | "dove"
  | "plate"
  | "ring"
  | "clock"
  | "plane"
  | "check"
  | "arrow-right"
  | "arrow-left"
  | "chevron-down"
  | "user-plus"
  | "pencil"
  | "download"
  | "send"
  | "heart"
  | "sun"
  | "moon"
  | "close"
  | "key"
  | "suitcase"
  | "cup"
  | "henna"
  | "pool"
  | "music"
  | "cheers"
  | "play"
  | "pause"
  | "cottage"
  | "steps"
  | "leaf"
  | "wifi"
  | "id"
  | "train"
  | "car"
  | "phone"
  | "copy"
  | "wave";

export type Tint = "sun" | "sky" | "coral" | "sea" | "palm" | "sand";

export type DayId = "day1" | "day2" | "day3";

export type WeddingDay = {
  id: DayId;
  label: string;
  /** "YYYY-MM-DD" */
  date: string;
  summary: string;
  /** The checkout morning: shown as a small extra, not a main day. */
  extra?: boolean;
};

export type WeddingEvent = {
  id: string;
  day: DayId;
  title: string;
  icon: IconName;
  tint: Tint;
  /** For "Till 10 AM" items this is just where the item begins on the timeline. */
  startsAt: string;
  endsAt: string | null;
  /** "Till …" items: there's no fixed start time, only an end. */
  untilOnly?: boolean;
  /** Big moments: shown on the save-the-date and in the whole-weekend calendar file. */
  highlight?: boolean;
  /** Meals link to the RSVP food question. */
  meal?: boolean;
  /** A spot inside the resort, e.g. "Poolside". Leave out for just the resort. */
  venue?: string;
  mapsUrl?: string | null;
  blurb: string;
};

export const wedding = {
  partnerA: "[Partner A]",
  partnerB: "[Partner B]",
  monogram: "[A] & [B]",
  venue: "Stone Water Eco Resort",
  place: "Bogmalo, Goa",
  /** For maps, cabs and calendar invites. */
  address: "Karma Woodhouse Estate, Santarem Beach, Issorcim, Dabolim, Goa 403806",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Stone%20Water%20Eco%20Resort%2C%20Santarem%20Beach%2C%20Bogmalo%2C%20Goa",
  /** The resort's front desk, from stonewaterecoresort.com. */
  venuePhone: "+91 88882 82828",
  venueSite: "https://stonewaterecoresort.com",
  timeZone: "Asia/Kolkata",
  /** Starting values only: change both on the dashboard (Site settings). "YYYY-MM-DD" or null. */
  rsvpDeadline: null as string | null,
  contact: "[contact]",

  /** South Goa, late January 2027 (sunrise-sunset.org): drives the sky on the timeline. */
  sun: { rise: 7.05, set: 18.54, duskEnds: 18.9 },

  days: [
    { id: "day1", label: "Day 1", date: "2027-01-30", summary: "Mehndi & pool party" },
    { id: "day2", label: "Day 2", date: "2027-01-31", summary: "The wedding & gala dinner" },
    { id: "day3", label: "Day 3", date: "2027-02-01", summary: "Breakfast & checkout", extra: true },
  ] as WeddingDay[],

  events: [
    // ── Day 1 · Saturday 30 January ──────────────────────────────
    {
      id: "d1-checkin",
      day: "day1",
      title: "Check-in",
      icon: "key",
      tint: "sand",
      startsAt: "2027-01-30T14:00:00+05:30",
      endsAt: null,
      blurb: "Welcome to Goa! Your key's waiting at reception. Drop your bags, find your cottage and kick off your shoes.",
    },
    {
      id: "d1-lunch",
      day: "day1",
      title: "Lunch",
      icon: "plate",
      tint: "sun",
      startsAt: "2027-01-30T14:00:00+05:30",
      endsAt: "2027-01-30T16:00:00+05:30",
      meal: true,
      blurb: "A long, lazy welcome lunch while everyone rolls in.",
    },
    {
      id: "d1-mehndi",
      day: "day1",
      title: "Mehndi",
      icon: "henna",
      tint: "palm",
      startsAt: "2027-01-30T16:00:00+05:30",
      endsAt: "2027-01-30T19:00:00+05:30",
      highlight: true,
      blurb: "Henna, music and a lot of giggling. Sit still — it's worth it.",
    },
    {
      id: "d1-pool",
      day: "day1",
      title: "Pool Party",
      icon: "pool",
      tint: "sky",
      startsAt: "2027-01-30T17:00:00+05:30",
      endsAt: "2027-01-30T19:00:00+05:30",
      highlight: true,
      venue: "Poolside",
      blurb: "Swimsuits on! Splash about while the sun sinks into the sea.",
    },
    {
      id: "d1-dinner",
      day: "day1",
      title: "Dinner",
      icon: "plate",
      tint: "coral",
      startsAt: "2027-01-30T21:00:00+05:30",
      endsAt: null,
      meal: true,
      blurb: "Dinner under the stars to wrap up day one.",
    },

    // ── Day 2 · Sunday 31 January ────────────────────────────────
    {
      id: "d2-breakfast",
      day: "day2",
      title: "Breakfast",
      icon: "cup",
      tint: "sun",
      startsAt: "2027-01-31T07:30:00+05:30",
      endsAt: "2027-01-31T10:00:00+05:30",
      untilOnly: true,
      meal: true,
      blurb: "Slow breakfast. Sunglasses optional, coffee strongly advised.",
    },
    {
      id: "d2-leisure",
      day: "day2",
      title: "Leisure",
      icon: "umbrella",
      tint: "sea",
      startsAt: "2027-01-31T10:00:00+05:30",
      endsAt: "2027-01-31T13:00:00+05:30",
      untilOnly: true,
      blurb: "Beach (it's just down the steps), pool or nap — your call. (We'll probably be napping.)",
    },
    {
      id: "d2-lunch",
      day: "day2",
      title: "Lunch",
      icon: "plate",
      tint: "sun",
      startsAt: "2027-01-31T13:00:00+05:30",
      endsAt: "2027-01-31T15:00:00+05:30",
      meal: true,
      blurb: "Fuel up. Big evening ahead!",
    },
    {
      id: "d2-wedding",
      day: "day2",
      title: "Wedding",
      icon: "dove",
      tint: "sky",
      startsAt: "2027-01-31T17:00:00+05:30",
      endsAt: "2027-01-31T19:00:00+05:30",
      highlight: true,
      venue: "The clifftop lawn",
      blurb: "The main event, on the lawn above the sea. We say “I do” as the sun dips — bring tissues, just in case.",
    },
    {
      id: "d2-gala",
      day: "day2",
      title: "Gala Dinner",
      icon: "cheers",
      tint: "coral",
      startsAt: "2027-01-31T20:00:00+05:30",
      endsAt: "2027-01-31T22:00:00+05:30",
      highlight: true,
      meal: true,
      blurb: "Game on! Tell us your food lineup in the RSVP so we can set aside the good stuff.",
    },
    {
      id: "d2-afterparty",
      day: "day2",
      title: "After Party",
      icon: "music",
      tint: "sea",
      startsAt: "2027-01-31T22:00:00+05:30",
      endsAt: "2027-02-01T02:00:00+05:30",
      highlight: true,
      blurb: "Dancing till the fairy lights give up.",
    },

    // ── Day 3 · Monday 1 February ────────────────────────────────
    {
      id: "d3-breakfast",
      day: "day3",
      title: "Breakfast",
      icon: "cup",
      tint: "sun",
      startsAt: "2027-02-01T07:30:00+05:30",
      endsAt: "2027-02-01T10:00:00+05:30",
      untilOnly: true,
      meal: true,
      blurb: "One last breakfast together (sleepy faces welcome).",
    },
    {
      id: "d3-checkout",
      day: "day3",
      title: "Checkout",
      icon: "suitcase",
      tint: "sand",
      startsAt: "2027-02-01T11:00:00+05:30",
      endsAt: null,
      blurb: "Hugs, photos and see-you-soons. Safe travels home!",
    },
  ] as WeddingEvent[],
};

export const coupleNames = `${wedding.partnerA} & ${wedding.partnerB}`;

export const mainDays = wedding.days.filter((d) => !d.extra);

export function eventsOn(day: DayId) {
  return wedding.events
    .filter((e) => e.day === day)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** Where an event happens, for people: "Poolside · Stone Water Eco Resort". */
export function venueOf(e: WeddingEvent) {
  return e.venue ? `${e.venue} · ${wedding.venue}` : wedding.venue;
}

/** Where an event happens, for calendar and map apps. */
export function locationOf(e?: WeddingEvent) {
  return [e?.venue, wedding.venue, wedding.address].filter(Boolean).join(", ");
}
