import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { wedding } from "@/content/wedding";
import { Avatar } from "@/components/Avatar";
import { DemoBanner } from "@/components/DemoBanner";
import { Icon } from "@/components/Icon";
import { getAccess } from "@/lib/access";
import { getControls, getUnlocked } from "@/lib/controls";
import { nowMs, rsvpClosed } from "@/lib/booth/phase";
import { getAdminData, getViewer } from "@/lib/data";
import { adminEmails, isDemo } from "@/lib/env";
import { getSiteUrl } from "@/lib/site";
import { computeStats, requestLabels, statusLabels, statusOf, type Status } from "@/lib/stats";
import { dayLabels, drinkStyleLabels, kidsLabel, mealLabels, rideLabels, slotLabels, travelLabels } from "@/lib/types";
import { fmtDay, fmtPhone } from "@/lib/rsvp-text";
import { cx, noteBg } from "@/lib/ui";
import { toggleGuestBlocked, toggleNoteHidden } from "./actions";
import { Planning } from "./Planning";
import { PlusOneRequests } from "./PlusOneRequests";
import { setUnlockedAction } from "./settings/actions";
import { Rehearsal } from "./Rehearsal";

export const metadata: Metadata = { title: "Couple's dashboard" };

const filters: { id: "all" | Status; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "coming", label: "Coming" },
  { id: "deciding", label: "Still deciding" },
  { id: "declined", label: "Can't make it" },
  { id: "waiting", label: "Not let in yet" },
  { id: "removed", label: "Removed" },
];

const statusStyle: Record<Status, string> = {
  coming: "bg-sea-200 text-sea-800",
  deciding: "bg-sun-100 text-ink",
  declined: "bg-sand-200 text-ink-soft",
  waiting: "bg-sky-200 text-ink",
  removed: "bg-coral-200 text-coral-800",
};

function flashText(q: { flash?: string | string[]; cleared?: string | string[]; fileErrors?: string | string[] }) {
  if (q.flash !== "live") return null;
  const n = Number(q.cleared);
  const files = Number(q.fileErrors);
  return [
    "You're live! Anyone with the link can sign in now.",
    Number.isFinite(n) && q.cleared !== undefined && `Test data cleared (${n} ${n === 1 ? "photo" : "photos"}).`,
    files > 0 && `${files} photo files couldn't be deleted from ImageKit; you can remove them from its media library.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-3xl bg-sand-50 p-5 shadow-[var(--shadow-rest)]">
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      <span className="text-[34px] leading-tight font-semibold">{value.toLocaleString("en-IN")}</span>
      {note && <span className="text-[13px] text-ink-soft">{note}</span>}
    </div>
  );
}


export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.isAdmin) notFound();

  const [{ rows, notes }, access, siteUrl, query, controls, unlockedIds] = await Promise.all([
    getAdminData(viewer),
    getAccess(),
    getSiteUrl(),
    searchParams,
    getControls(),
    getUnlocked(),
  ]);
  const closed = rsvpClosed(controls, nowMs());
  const unlocked = new Set(unlockedIds);
  const rehearsal = access.mode === "rehearsal";
  const stats = computeStats(rows);
  const filter = (filters.find((f) => f.id === query.show)?.id ?? "all") as "all" | Status;
  const visible = filter === "all" ? rows : rows.filter((r) => statusOf(r) === filter);
  const counts: Record<"all" | Status, number> = {
    all: rows.length,
    coming: stats.comingCount,
    deciding: stats.deciding,
    declined: stats.declined,
    waiting: stats.waiting,
    removed: stats.removed,
  };
  const flash = flashText(query);

  return (
    <div className="min-h-dvh">
      {isDemo && <DemoBanner />}
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-12">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-script text-[22px] font-bold text-ink no-underline hover:text-ink lg:text-[26px]">
            {wedding.monogram}
          </Link>
          <span className="rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white">Couple&apos;s dashboard</span>
          {rehearsal ? (
            <a href="#rehearsal-title" className="rounded-full bg-sun-100 px-3 py-1 text-sm font-semibold text-ink no-underline">
              Rehearsal
            </a>
          ) : (
            <span className="rounded-full bg-sea-200 px-3 py-1 text-sm font-semibold text-sea-800">
              Live{access.liveAt && ` since ${new Date(access.liveAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}`}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/booth" className="btn btn-sm btn-outline">
            <Icon name="polaroid" size={18} strokeWidth={2} />
            Booth control
          </Link>
          <Link href="/admin/settings" className="btn btn-sm btn-outline">
            <Icon name="key" size={18} strokeWidth={2} />
            Site settings
          </Link>
          <a href="/admin/export" className="btn btn-sm btn-sea">
            <Icon name="download" size={18} strokeWidth={2} />
            Download CSV
          </a>
          <Link href="/" className="btn btn-sm btn-ghost">
            Back to the site
          </Link>
        </div>
      </header>

      <main className="flex flex-col gap-10 px-4 pb-20 lg:px-12">
        {flash && (
          <p role="status" className="rounded-2xl bg-sea-200 px-4 py-3 font-semibold text-sea-800">
            {flash}
          </p>
        )}
        {rehearsal && (
          <Rehearsal
            access={access}
            couple={isDemo ? [viewer.guest.email] : adminEmails}
            waiting={rows.filter((r) => statusOf(r) === "waiting")}
          />
        )}

        {/* Headline numbers */}
        <section aria-labelledby="numbers" className="flex flex-col gap-4">
          <h1 id="numbers" className="font-serif text-[34px] leading-tight lg:text-[44px]">
            How it&apos;s looking
          </h1>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,3fr)]">
            <div className="flex flex-col justify-between gap-2 rounded-3xl bg-sea-700 p-6 text-white">
              <span className="text-[15px] font-semibold text-[#e4f5ef]">Total headcount</span>
              <span className="text-[64px] leading-none font-semibold">{stats.headcount.toLocaleString("en-IN")}</span>
              <span className="text-sm text-[#e4f5ef]">
                {[
                  `${stats.comingCount} confirmed`,
                  stats.expected && `${stats.expected} approved +1${stats.expected === 1 ? "" : "s"} yet to RSVP`,
                  stats.kids && `${stats.kids} ${stats.kids === 1 ? "kid" : "kids"}`,
                ]
                  .filter(Boolean)
                  .join(" + ")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Tile label="Day 1 · mehndi & pool party" value={stats.day1} note="people, incl. kids & +1s" />
              <Tile label="Day 2 · wedding & gala dinner" value={stats.day2} note="people, incl. kids & +1s" />
              <Tile label="Plus-ones approved" value={stats.approved} note={stats.pending ? `${stats.pending} to decide` : undefined} />
              <Tile label="Kids" value={stats.kids} note={stats.rooms.families.length ? `in ${stats.rooms.families.length} families` : undefined} />
              <Tile label="Still deciding" value={stats.deciding} note="signed in, not finished" />
              <Tile label="Can't make it" value={stats.declined} />
            </div>
          </div>
        </section>

        <PlusOneRequests rows={rows} rehearsal={rehearsal} siteUrl={siteUrl} />

        <Planning stats={stats} />

        {/* Guests */}
        <section aria-labelledby="guests-title" className="flex flex-col gap-4">
          <h2 id="guests-title" className="font-serif text-[28px]">
            Guests
          </h2>
          <nav aria-label="Filter guests" className="flex flex-wrap gap-2">
            {filters.filter((f) => f.id !== "waiting" || rehearsal || counts.waiting > 0).map((f) => (
              <Link
                key={f.id}
                href={f.id === "all" ? "/admin" : `/admin?show=${f.id}`}
                aria-current={filter === f.id ? "true" : undefined}
                className={cx(
                  "flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-[15px] font-semibold no-underline",
                  filter === f.id
                    ? "border-ink bg-ink text-white hover:text-white"
                    : "border-sand-300 bg-sand-50 text-ink hover:text-ink",
                )}
              >
                {f.label}
                <span className="tabular-nums opacity-80">{counts[f.id]}</span>
              </Link>
            ))}
          </nav>
          <div className="relative overflow-x-auto rounded-[24px] bg-sand-50 shadow-[var(--shadow-rest)]">
            <table className="w-full min-w-[1180px] border-collapse text-left text-[15px]">
              <thead>
                <tr className="bg-sea-200 text-sm">
                  <th scope="col" className="px-4 py-3">Guest</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Days</th>
                  <th scope="col" className="px-4 py-3">With them</th>
                  <th scope="col" className="px-4 py-3">Roomie</th>
                  <th scope="col" className="px-4 py-3">Food &amp; drink</th>
                  <th scope="col" className="px-4 py-3">Travel</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-ink-soft">
                      Nobody here yet.
                    </td>
                  </tr>
                )}
                {visible.map((r) => {
                  const s = statusOf(r);
                  const x = r.rsvp;
                  return (
                    <tr key={r.id} className="border-t border-sand-200 align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.displayName || r.email} url={r.avatarUrl} size={36} />
                          <div className="flex min-w-0 flex-col">
                            <span className="font-semibold">{r.displayName || "—"}</span>
                            <span className="truncate text-[13px] text-ink-soft">{r.email}</span>
                            {x?.whatsapp && <span className="text-[13px] tabular-nums text-ink-soft">{fmtPhone(x.whatsapp)}</span>}
                            {r.plusOneOf && (
                              <span className="text-[13px] font-semibold text-sea-800">
                                {r.plusOneOf.name}&apos;s +1{r.plusOneOf.status !== "approved" && ` (${requestLabels[r.plusOneOf.status].toLowerCase()})`}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cx("inline-block rounded-full px-2.5 py-1 text-[13px] font-bold", statusStyle[s])}>
                          {statusLabels[s]}
                        </span>
                      </td>
                      <td className="px-4 py-3">{x?.days ? dayLabels[x.days] : "—"}</td>
                      <td className="px-4 py-3">
                        {r.request ? (
                          <>
                            +1: {r.request.name}
                            <span className="block text-[13px] text-ink-soft">{requestLabels[r.request.status]}</span>
                          </>
                        ) : x?.plusOne === false && !x.kids.length ? (
                          "Just them"
                        ) : !x?.kids.length ? (
                          "—"
                        ) : null}
                        {x?.kids.length ? <span className="block">{kidsLabel(x.kids)}</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        {x?.roomie === "plus_one" ? "Their +1" : x?.roomie === "guest" ? x.roomieName : x?.roomie === "pair_me" ? "Pair them up" : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {x?.meal ? mealLabels[x.meal] : "—"}
                        {x?.dietaryNotes ? <span className="block text-[13px] text-ink-soft">{x.dietaryNotes}</span> : null}
                        {x?.drinks ? (
                          <span className="block text-[13px] text-ink-soft">
                            {x.drinks === "no" ? "Mocktails" : x.drinkStyles.map((d) => drinkStyleLabels[d]).join(", ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {x?.arrivalDate ? fmtDay(x.arrivalDate) : "—"}
                        {x?.arrivalSlot ? `, ${slotLabels[x.arrivalSlot].toLowerCase()}` : ""}
                        {x?.travelMode ? (
                          <span className="block text-[13px] text-ink-soft">
                            {x.arrivalPoint ?? travelLabels[x.travelMode]}
                            {x.departureDate ? ` · home ${fmtDay(x.departureDate)}` : ""}
                          </span>
                        ) : null}
                        {x?.rideHelp && x.rideHelp !== "sorted" ? <span className="block text-[13px] text-sea-800">{rideLabels[x.rideHelp]}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {closed && !r.blocked && !r.waiting && (
                          <form action={setUnlockedAction}>
                            <input type="hidden" name="guestId" value={r.id} />
                            <input type="hidden" name="unlocked" value={String(!unlocked.has(r.id))} />
                            <button
                              type="submit"
                              className={cx(
                                "min-h-11 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap",
                                unlocked.has(r.id) ? "bg-sun-100 text-ink hover:bg-sun-300" : "text-sea-800 hover:bg-sea-200",
                              )}
                              title={unlocked.has(r.id) ? "They can edit their RSVP until they finish it" : undefined}
                            >
                              {unlocked.has(r.id) ? "Unlocked · Lock" : "Unlock RSVP"}
                            </button>
                          </form>
                        )}
                        {r.id !== viewer.guest.id && (
                          <form action={toggleGuestBlocked}>
                            <input type="hidden" name="guestId" value={r.id} />
                            <input type="hidden" name="blocked" value={String(!r.blocked)} />
                            <button
                              type="submit"
                              className={cx(
                                "min-h-11 rounded-full px-3.5 text-sm font-semibold",
                                r.blocked ? "text-sea-800 hover:bg-sea-200" : "text-coral-800 hover:bg-coral-200",
                              )}
                            >
                              {r.blocked ? "Restore" : "Remove"}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ink-soft">
            {rehearsal
              ? "Rehearsal: only you two and your testers can get in for now."
              : "Anyone with the link can sign in."}{" "}
            &ldquo;Remove&rdquo; hides a stranger from the wall and blocks their RSVP and notes.
          </p>
        </section>

        {/* Notes */}
        <section aria-labelledby="notes-title" className="flex flex-col gap-4">
          <h2 id="notes-title" className="font-serif text-[28px]">
            Guest wall notes <span className="text-lg text-ink-soft">({notes.length})</span>
          </h2>
          {notes.length === 0 ? (
            <p className="text-ink-soft">No notes yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className={cx("flex flex-col gap-3 rounded-2xl p-4", noteBg[n.color], n.hidden && "opacity-60")}
                >
                  <p className="font-script text-lg leading-snug">{n.body}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">
                      — {n.authorName}
                      {n.hidden && <span className="ml-2 font-semibold text-coral-800">(hidden)</span>}
                    </span>
                    <form action={toggleNoteHidden}>
                      <input type="hidden" name="noteId" value={n.id} />
                      <input type="hidden" name="hidden" value={String(!n.hidden)} />
                      <button type="submit" className="min-h-11 rounded-full px-3.5 text-sm font-semibold text-ink hover:bg-black/5">
                        {n.hidden ? "Show" : "Hide"}
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
