import Link from "next/link";
import { redirect } from "next/navigation";
import { coupleNames } from "@/content/wedding";
import { DemoBanner } from "@/components/DemoBanner";
import { Icon } from "@/components/Icon";
import { SiteHeader } from "@/components/SiteHeader";
import { TabBar } from "@/components/TabBar";
import { ShareTray } from "@/components/booth/ShareTray";
import { UploadToast } from "@/components/booth/UploadToast";
import { Illustration, Wave } from "@/components/Decor";
import { getRsvp, getViewer } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { formatDateSpan } from "@/lib/format";
import { phaseFor } from "@/lib/booth/viewer-phase";
import { getClock } from "@/lib/clock";
import { getControls, getRsvpGate } from "@/lib/controls";
import { Announcement, PreviewStrip } from "@/components/SiteNotices";
import { signOut } from "./actions";

export default async function GuestLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const controls = await getControls();

  if (viewer.guest.blocked) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="kicker text-3xl text-coral-800">Hmm…</p>
        <h1 className="max-w-lg font-serif text-4xl leading-tight">We couldn&apos;t find your invite.</h1>
        <p className="max-w-md text-lg text-ink-soft">
          If you think that&apos;s a mistake, give us a shout at {controls.contact} and we&apos;ll sort it out.
        </p>
        <form action={signOut}>
          <button className="btn btn-outline">Sign out</button>
        </form>
      </main>
    );
  }

  // Rehearsal mode: only the couple and their testers get past this.
  if (viewer.waiting) {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden px-6 text-center">
        <Illustration name="boat" className="animate-bob pointer-events-none w-[220px] lg:w-[260px]" />
        <p className="kicker text-3xl text-sea-700">You&apos;re early!</p>
        <h1 className="max-w-lg font-serif text-4xl leading-tight text-balance">We&apos;re still putting the finishing touches on this.</h1>
        <p className="max-w-md text-lg text-ink-soft">
          {coupleNames} will let you know the moment it&apos;s ready. Come back then, and sign in with this same Google
          account ({viewer.guest.email}).
        </p>
        <form action={signOut}>
          <button className="btn btn-outline">Sign out</button>
        </form>
      </main>
    );
  }

  const [rsvp, { phase }, gate, clock] = await Promise.all([
    getRsvp(viewer.guest.id),
    phaseFor(viewer),
    getRsvpGate(viewer),
    getClock(viewer),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      {isDemo && <DemoBanner />}
      {clock.preview && <PreviewStrip now={clock.now} couple={viewer.isAdmin} />}
      <Announcement text={controls.banner} at={controls.bannerAt} />
      <SiteHeader name={viewer.guest.displayName} avatarUrl={viewer.guest.avatarUrl} isAdmin={viewer.isAdmin} />
      <main className="flex-1">{children}</main>
      <footer className="pb-24 lg:pb-0">
        <Wave fill="#1F7A6B" className="-mb-px" />
        <div className="flex flex-col gap-6 bg-sea-700 px-6 pt-4 pb-10 text-white lg:flex-row lg:items-center lg:justify-between lg:px-24 lg:pt-6">
          <div className="flex flex-col gap-1.5">
            <p className="kicker text-[32px] lg:text-[40px]">See you by the sea!</p>
            <p className="text-base text-[#e4f5ef]">
              {coupleNames} · {formatDateSpan()} · Goa
            </p>
          </div>
          <Link
            href="/profile#help"
            className="btn self-start bg-white/12 text-white hover:text-white lg:self-auto"
          >
            <Icon name="ring" size={24} />
            Questions? Reach us at {controls.contact}
          </Link>
        </div>
      </footer>
      <TabBar phase={phase} rsvpPending={!rsvp.completed} rsvpClosed={gate.closed} />
      {phase === "open" && <ShareTray />}
      <UploadToast />
    </div>
  );
}
