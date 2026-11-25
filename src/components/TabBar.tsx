"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconName } from "@/content/wedding";
import { Icon } from "@/components/Icon";
import { SnapInput } from "@/components/booth/SnapInput";
import type { BoothPhase } from "@/lib/booth/phase";
import { cx } from "@/lib/ui";

type Tab = { href: string; label: string; icon: IconName; dot?: boolean };

/**
 * Phone-only bottom navigation. It changes through the weekend:
 * - before the booth opens: Home · Plan · RSVP (· My RSVP once RSVPs close) · Wall · Me
 * - from 6 AM, Sat 30 Jan: Home · Plan · [Snap] · Booth · Me
 * - after uploads close: Home · Plan · Booth · Wall · Me
 * Hidden inside the RSVP flow so guests stay focused.
 */
export function TabBar({
  phase,
  rsvpPending,
  rsvpClosed,
}: {
  phase: BoothPhase;
  rsvpPending: boolean;
  rsvpClosed: boolean;
}) {
  const pathname = usePathname();
  if (pathname === "/rsvp" && !rsvpClosed) return null;

  const home: Tab = { href: "/", label: "Home", icon: "home" };
  const plan: Tab = { href: "/schedule", label: "Plan", icon: "calendar" };
  const wall: Tab = { href: "/wall", label: "Wall", icon: "shell" };
  const me: Tab = { href: "/profile", label: "Me", icon: "user" };
  const boothTab: Tab = { href: "/booth", label: "Booth", icon: "polaroid" };
  const rsvp: Tab = rsvpClosed
    ? { href: "/rsvp", label: "My RSVP", icon: "check" }
    : { href: "/rsvp", label: "RSVP", icon: "envelope", dot: rsvpPending };

  const tabs: (Tab | "snap")[] =
    phase === "open"
      ? [home, plan, "snap", boothTab, me]
      : phase === "closed"
        ? [home, plan, boothTab, wall, me]
        : [home, plan, rsvp, wall, me];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#eadbc0] bg-sand-50 px-1.5 pt-1.5 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      {tabs.map((t) => {
        if (t === "snap") {
          return (
            <SnapInput
              key="snap"
              label="Snap or share photos"
              className="flex flex-col items-center justify-start gap-[3px] rounded-full text-xs font-bold text-ink"
            >
              <span className="-mt-[26px] flex size-[62px] items-center justify-center rounded-full border-4 border-sand-50 bg-coral-600 text-white shadow-[0_8px_18px_rgb(181_71_47/0.35)] transition-transform duration-200 active:scale-95">
                <Icon name="camera" size={28} strokeWidth={2} />
              </span>
              Snap
            </SnapInput>
          );
        }
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex min-h-[52px] flex-col items-center justify-center gap-[3px] text-xs no-underline",
              active ? "font-bold text-sea-800 hover:text-sea-800" : "font-semibold text-ink-soft hover:text-ink",
            )}
          >
            <span className={cx("relative flex h-[30px] w-14 items-center justify-center rounded-full", active && "bg-sea-200")}>
              <Icon name={t.icon} strokeWidth={active ? 1.9 : 1.75} />
              {t.dot && (
                <span className="absolute top-0.5 right-3 size-[9px] rounded-full border-2 border-sand-50 bg-coral-600">
                  <span className="sr-only">RSVP pending</span>
                </span>
              )}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
