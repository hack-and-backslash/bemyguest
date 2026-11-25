import type { IconName, Tint } from "@/content/wedding";
import type { NoteColor } from "@/lib/types";

export const tintBg: Record<Tint, string> = {
  sun: "bg-sun-100",
  sky: "bg-sky-200",
  coral: "bg-coral-200",
  sea: "bg-sea-200",
  palm: "bg-palm-100",
  sand: "bg-sand-200",
};

export const tintStrong: Record<Tint, string> = {
  sun: "bg-ink",
  sky: "bg-sky-700",
  coral: "bg-coral-600",
  sea: "bg-sea-700",
  palm: "bg-palm-700",
  sand: "bg-ink",
};

export const noteBg: Record<NoteColor, string> = {
  sun: "bg-sun-100",
  coral: "bg-coral-200",
  sea: "bg-sea-200",
  sky: "bg-sky-200",
};

export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: IconName;
  tint: Tint;
  blurb: string;
};

export const navItems: NavItem[] = [
  { href: "/schedule", label: "Schedule", short: "Plan", icon: "calendar", tint: "sky", blurb: "Two days of big moments" },
  { href: "/rsvp", label: "RSVP", short: "RSVP", icon: "envelope", tint: "coral", blurb: "Tell us you're coming" },
  { href: "/wall", label: "Guest wall", short: "Wall", icon: "shell", tint: "sea", blurb: "See who's coming, leave a note" },
  { href: "/stay", label: "Stay", short: "Stay", icon: "cottage", tint: "sun", blurb: "Your cottage by the sea, on us" },
  { href: "/travel", label: "Getting there", short: "Travel", icon: "pin", tint: "palm", blurb: "Ten minutes from Goa airport" },
  { href: "/booth", label: "Photo Booth", short: "Booth", icon: "polaroid", tint: "sand", blurb: "Share photos, live from Goa" },
];

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
