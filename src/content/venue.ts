/**
 * The Stay and Getting there pages read from here. Change any words, numbers
 * or list items in this file and the pages update. Venue name, address and
 * map link live in content/wedding.ts.
 *
 * Resort facts come from stonewaterecoresort.com; travel distances are
 * approximate door-to-door figures for the Bogmalo side of Dabolim.
 */
import type { IconName, Tint } from "@/content/wedding";

export type InfoItem = { icon: IconName; tint: Tint; title: string; body: string };

export const stay = {
  kicker: "Where you'll sleep",
  title: "Two nights on us, in a cottage by the sea.",
  intro:
    "We've taken over Stone Water Eco Resort for the weekend: twenty green acres on a cliff above Santarem Beach, with laterite paths, big shady trees and the Arabian Sea at the bottom of the garden. Your cottage and all the meals on the plan are on us. You just have to show up.",

  cottage: {
    title: "Your cottage",
    body: "Most of us are in wooden chalets with clay-tile roofs, tucked under the trees. Some look out to sea, some onto the gardens, and it's a lucky dip. Give your name at reception and your key's ready.",
    amenities: [
      "Air-conditioning",
      "A big, comfy bed",
      "Your own bathroom, with toiletries, a bathrobe and slippers",
      "Mini fridge and drinking water",
      "A desk, a sofa and a TV (you won't need it)",
    ],
  },

  /** "Around the resort" tiles. */
  grounds: [
    {
      icon: "dove",
      tint: "sky",
      title: "The clifftop lawn",
      body: "Terraced lawns above the water. This is where we say “I do” on Sunday evening.",
    },
    {
      icon: "pool",
      tint: "sea",
      title: "Pools with a view",
      body: "Including an infinity pool looking out to sea. Saturday's pool party is here.",
    },
    {
      icon: "steps",
      tint: "sand",
      title: "Steps to the beach",
      body: "A flight of stone steps takes you down to Santarem Beach for a dip or a sunset walk.",
    },
    {
      icon: "plate",
      tint: "sun",
      title: "Stone Water Grill",
      body: "The resort's restaurant and bar, cooking Goan and continental food.",
    },
    {
      icon: "leaf",
      tint: "palm",
      title: "Spa & slow mornings",
      body: "There's a spa and an outdoor gym, if you're that kind of wedding guest.",
    },
    {
      icon: "wave",
      tint: "coral",
      title: "Under the water",
      body: "Bogmalo is one of Goa's diving spots. Ask at the desk about dives and water sports.",
    },
  ] satisfies InfoItem[],

  goodToKnow: [
    {
      icon: "steps",
      tint: "sand",
      title: "Lots of steps and slopes",
      body: "The resort sits on a hillside, so expect plenty of walking between cottages, lawns and pools. Flat shoes or block heels are your best friends on the grass. If stairs are hard for anyone in your group, tell us and we'll ask for a cottage close to the main paths.",
    },
    {
      icon: "sun",
      tint: "sun",
      title: "Warm days, breezy nights",
      body: "Late January is Goa at its best: around 30°C by day, nearer 20°C after dark, and hardly any chance of rain. Bring a light layer for the evenings.",
    },
    {
      icon: "leaf",
      tint: "palm",
      title: "It's an eco resort",
      body: "Lots of trees means lots of nature, including the odd mosquito once the sun goes down. Pack repellent and you'll be fine.",
    },
    {
      icon: "wifi",
      tint: "sky",
      title: "Wi-Fi is… relaxed",
      body: "It's strongest around reception and the restaurant, and can be patchy in the cottages. Call it a digital detox.",
    },
    {
      icon: "id",
      tint: "coral",
      title: "Bring photo ID",
      body: "Everyone checking in needs a government photo ID. Visiting from abroad? Bring your passport and visa.",
    },
  ] satisfies InfoItem[],

  packing: [
    "Photo ID (passport and visa if you're visiting India)",
    "Outfits for the mehndi, the wedding and the gala dinner",
    "Swimsuit for the pool party",
    "Flat shoes or block heels for the lawns and steps",
    "Dancing shoes for the after party",
    "Sunscreen, sunnies and a hat",
    "Mosquito repellent",
    "A light layer for breezy evenings",
    "Sandals for the beach steps",
    "Chargers and a power bank",
  ],
};

export type Airport = {
  code: string;
  name: string;
  distance: string;
  time: string;
  body: string;
  closest?: boolean;
};

export type Station = { name: string; distance: string; time: string; body: string };

export const travel = {
  kicker: "Getting there",
  title: "Land in Goa and you're ten minutes from the party.",
  intro:
    "Stone Water is on the Bogmalo coast in South Goa, right next to Dabolim airport. Here's how to reach us by air, rail or road.",

  airports: [
    {
      code: "GOI",
      name: "Dabolim",
      distance: "about 5 km",
      time: "10–15 min by cab",
      body: "Goa's older airport, practically next door. If you can, fly in here.",
      closest: true,
    },
    {
      code: "GOX",
      name: "Mopa (Manohar International)",
      distance: "about 90 km",
      time: "2–2½ hours by cab",
      body: "Up in North Goa. Fine if the fares are better, but plan for the long drive down.",
    },
  ] satisfies Airport[],

  airportTip:
    "Both airports show up as “Goa” when you book, so check the code before you pay. GOI is the one near us.",

  cabs: "At both airports there's a government prepaid taxi counter in arrivals, and you can book GoaMiles, Goa's official cab app. Uber and Ola don't pick up at Goa's airports.",

  stations: [
    {
      name: "Vasco da Gama (VSG)",
      distance: "about 8 km",
      time: "20 min by cab",
      body: "The closest station to us.",
    },
    {
      name: "Madgaon Junction (MAO)",
      distance: "about 25 km",
      time: "45 min by cab",
      body: "The main stop on the Konkan Railway, with the most trains.",
    },
  ] satisfies Station[],

  road: "Driving down? From Panaji it's about 30 km, under an hour over the Zuari bridge. Use the map link above to get to the gate.",

  /** Heading home on checkout day. */
  goingHome: [
    { code: "GOI", text: "a flight from about 1 PM onwards" },
    { code: "GOX", text: "a flight from about 3:30 PM onwards" },
  ],
};
