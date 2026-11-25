import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { wedding } from "@/content/wedding";
import { DemoBanner } from "@/components/DemoBanner";
import { Icon } from "@/components/Icon";
import { getAdminData, getViewer } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { getClock } from "@/lib/clock";
import { getControls, getUnlocked } from "@/lib/controls";
import { boothPhase, deadlineEnd, nowMs, rsvpClosed } from "@/lib/booth/phase";
import { formatDeadline, formatStamp } from "@/lib/format";
import { cx } from "@/lib/ui";
import { setPreviewAction } from "@/app/(guest)/actions";
import { setBoothPausedAction, setUnlockedAction } from "./actions";
import { BannerForm, BoothForm, ContactForm, RsvpForm } from "./SettingsForms";

export const metadata: Metadata = { title: "Site settings" };

const IST = 5.5 * 3_600_000;
/** An instant as "YYYY-MM-DDTHH:mm" in India time, for datetime-local boxes. */
const istInput = (ms: number) => new Date(ms + IST).toISOString().slice(0, 16);

function Card({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="card flex scroll-mt-6 flex-col gap-4 rounded-[28px] p-5 lg:p-7">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="font-serif text-[26px] leading-tight">
          {title}
        </h2>
        {intro && <div className="text-[15px] leading-relaxed text-ink-soft">{intro}</div>}
      </div>
      {children}
    </section>
  );
}

function Status({ tone, children }: { tone: "sea" | "coral" | "sun"; children: React.ReactNode }) {
  const bg = { sea: "bg-sea-200 text-sea-800", coral: "bg-coral-200 text-coral-800", sun: "bg-sun-100 text-ink" }[tone];
  return <p className={cx("self-start rounded-2xl px-4 py-2.5 text-[15px] font-semibold", bg)}>{children}</p>;
}

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.isAdmin) notFound();

  const [c, unlocked, clock, { rows }] = await Promise.all([getControls(), getUnlocked(), getClock(viewer), getAdminData(viewer)]);
  const now = nowMs();
  const closed = rsvpClosed(c, now);
  const rsvpStatus =
    c.rsvpMode === "closed"
      ? { tone: "coral" as const, text: "RSVPs are closed (you closed them)." }
      : c.rsvpMode === "open"
        ? { tone: "sun" as const, text: "RSVPs are open, and stay open until you change this." }
        : !c.rsvpDeadline
          ? { tone: "sea" as const, text: "RSVPs are open, with no deadline." }
          : closed
            ? { tone: "coral" as const, text: `RSVPs closed at the end of ${formatDeadline(c.rsvpDeadline)}.` }
            : { tone: "sea" as const, text: `RSVPs are open until the end of ${formatDeadline(c.rsvpDeadline)}.` };
  const phase = boothPhase(c, now);
  const boothStatus = c.boothPaused
    ? { tone: "coral" as const, text: "New photos are paused. Guests can still look, heart and download." }
    : phase === "teaser"
      ? { tone: "sun" as const, text: `Opens ${formatStamp(c.boothOpensAt)}.` }
      : phase === "open"
        ? { tone: "sea" as const, text: `Open for photos until ${formatStamp(c.boothClosesAt)}.` }
        : { tone: "sun" as const, text: "Uploads are closed; the booth is the photo album now." };
  const names = new Map(rows.map((r) => [r.id, r.displayName || r.email]));

  // Handy moments to preview.
  const [d1, d2] = wedding.days;
  const presets: [string, string][] = [
    ...(c.rsvpDeadline ? ([["The day after RSVPs close", istInput(deadlineEnd(c.rsvpDeadline) + 12 * 3_600_000)]] as [string, string][]) : []),
    ["Day 1, 6:30 PM", `${d1.date}T18:30`],
    ["Day 2, 5:00 PM", `${d2.date}T17:00`],
    ["After the weekend", `${wedding.days[wedding.days.length - 1].date}T18:00`],
    ["After uploads close", istInput(Date.parse(c.boothClosesAt) + 3_600_000)],
  ];

  return (
    <div className="min-h-dvh">
      {isDemo && <DemoBanner />}
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-12">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-script text-[22px] font-bold text-ink no-underline hover:text-ink lg:text-[26px]">
            {wedding.monogram}
          </Link>
          <span className="rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white">Site settings</span>
        </div>
        <Link href="/admin" className="btn btn-sm btn-outline">
          <Icon name="arrow-left" size={18} strokeWidth={2} />
          Dashboard
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-20">
        <nav aria-label="Settings sections" className="flex flex-wrap gap-2 text-sm font-semibold">
          {[
            ["rsvp", "RSVPs"],
            ["booth", "Photo booth"],
            ["announce", "Announcement"],
            ["contact", "Contact"],
            ["preview", "Preview a date"],
          ].map(([id, l]) => (
            <a key={id} href={`#${id}`} className="rounded-full bg-sand-50 px-3.5 py-2 text-ink no-underline shadow-[var(--shadow-rest)] hover:text-ink">
              {l}
            </a>
          ))}
        </nav>

        <Card id="rsvp" title="RSVPs">
          <Status tone={rsvpStatus.tone}>{rsvpStatus.text}</Status>
          <RsvpForm deadline={c.rsvpDeadline ?? ""} mode={c.rsvpMode} />
          <div className="flex flex-col gap-2 border-t border-sand-200 pt-4">
            <h3 className="text-[17px] font-bold">Let someone change their answers</h3>
            <p className="text-sm text-ink-soft">
              Once RSVPs close, use <b>Unlock RSVP</b> next to a guest on the dashboard. They can edit again until they
              finish, then it locks by itself.
            </p>
            {unlocked.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {unlocked.map((id) => (
                  <li key={id} className="flex min-h-10 items-center gap-1 rounded-full bg-sun-100 pl-3.5 text-sm font-semibold">
                    {names.get(id) ?? "A guest"} can edit
                    <form action={setUnlockedAction}>
                      <input type="hidden" name="guestId" value={id} />
                      <input type="hidden" name="unlocked" value="false" />
                      <button className="min-h-10 rounded-full px-3 text-[13px] font-semibold text-sea-800 hover:bg-black/5">Lock</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card id="booth" title="Photo booth">
          <div className="flex flex-wrap items-center gap-3">
            <Status tone={boothStatus.tone}>{boothStatus.text}</Status>
            <form action={setBoothPausedAction}>
              <input type="hidden" name="paused" value={String(!c.boothPaused)} />
              <button className={cx("btn btn-sm", c.boothPaused ? "btn-sea" : "btn-outline")}>
                <Icon name={c.boothPaused ? "play" : "pause"} size={18} strokeWidth={2} />
                {c.boothPaused ? "Resume new photos" : "Pause new photos"}
              </button>
            </form>
          </div>
          <BoothForm
            opens={istInput(Date.parse(c.boothOpensAt))}
            closes={istInput(Date.parse(c.boothClosesAt))}
            perGuest={c.boothMaxPerGuest}
            budget={c.boothBudgetMB}
          />
        </Card>

        <Card
          id="announce"
          title="Announcement"
          intro="One line across the top of every page, for things everyone needs to know now: a time change, rain plans, the shuttle."
        >
          {c.banner && c.bannerAt && <Status tone="sun">Up since {formatStamp(c.bannerAt)}</Status>}
          <BannerForm banner={c.banner} />
        </Card>

        <Card id="contact" title="Contact">
          <ContactForm contact={c.contact} />
        </Card>

        <Card
          id="preview"
          title="Preview the site as a date"
          intro="See the whole site as guests will at another moment: RSVPs closed, the booth open, the schedule's “happening now”. Only you see it, and saving still works as normal."
        >
          {clock.preview && (
            <div className="flex flex-wrap items-center gap-3">
              <Status tone="sun">Previewing as on {formatStamp(new Date(clock.now).toISOString())}</Status>
              <form action={setPreviewAction}>
                <input type="hidden" name="at" value="now" />
                <button className="btn btn-sm btn-outline">Back to now</button>
              </form>
            </div>
          )}
          <form action={setPreviewAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="to" value="/" />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="preview-at" className="text-[15px] font-semibold">
                Date and time (India)
              </label>
              <input id="preview-at" name="at" type="datetime-local" required defaultValue={istInput(clock.now)} className="field" />
            </div>
            <button className="btn btn-sm btn-sea">
              <Icon name="eye" size={18} strokeWidth={2} />
              Preview
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {presets.map(([l, at]) => (
              <form key={l} action={setPreviewAction}>
                <input type="hidden" name="at" value={at} />
                <input type="hidden" name="to" value="/" />
                <button className="min-h-10 rounded-full border-[1.5px] border-sand-300 bg-sand-50 px-3.5 text-sm font-semibold hover:border-ink">
                  {l}
                </button>
              </form>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
