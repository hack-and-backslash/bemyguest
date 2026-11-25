/* eslint-disable @next/next/no-img-element -- thumbnails from our CDN */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { wedding } from "@/content/wedding";
import { DemoBanner } from "@/components/DemoBanner";
import { Icon } from "@/components/Icon";
import { getViewer } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { adminPhotos } from "@/lib/booth/data";
import { MAX_BYTES, storageMode } from "@/lib/booth/storage";
import { getControls } from "@/lib/controls";
import { formatStamp, formatWeekdayDate } from "@/lib/format";
import { cx } from "@/lib/ui";
import { archiveCounts } from "@/lib/booth/archive";
import { driveStatus } from "@/lib/google-drive";
import { togglePhotoHidden } from "../actions";
import { setBoothPausedAction } from "../settings/actions";
import { DayDownloads, type DayGroup } from "./DayDownloads";
import { DriveArchive } from "./DriveArchive";

export const metadata: Metadata = { title: "Booth control" };

const IST = 5.5 * 3_600_000;
const istDay = (iso: string) => new Date(Date.parse(iso) + IST).toISOString().slice(0, 10);

/** ImageKit's free plan holds 3 GB of files (about 6,000 booth photos). */
const FREE_BYTES = 3e9;

function size(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col rounded-[18px] bg-sand-50 p-3 shadow-[var(--shadow-rest)] lg:p-5">
      <span className="font-serif text-[26px] lg:text-[34px]">{value.toLocaleString("en-IN")}</span>
      <span className="text-[13px] font-semibold text-ink-soft lg:text-sm">{label}</span>
    </div>
  );
}

export default async function BoothControlPage({ searchParams }: PageProps<"/admin/booth">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.isAdmin) notFound();

  const [photos, drive, archive, q, controls] = await Promise.all([
    adminPhotos(viewer),
    driveStatus(),
    archiveCounts(),
    searchParams,
    getControls(),
  ]);
  const lineGB = (controls.boothBudgetMB / 1000).toFixed(1);
  const flash =
    q.drive === "connected"
      ? { ok: true, text: "Google Drive is connected. You can archive whenever you like." }
      : q.drive === "error"
        ? { ok: false, text: typeof q.msg === "string" ? q.msg : "Couldn't connect Google Drive." }
        : null;
  const hidden = photos.filter((p) => p.hidden).length;
  const snappers = new Set(photos.filter((p) => !p.hidden).map((p) => p.guestId)).size;
  const bytes = photos.reduce((n, p) => n + p.bytes, 0);
  const used = bytes / FREE_BYTES;
  const paused = bytes + MAX_BYTES > controls.boothBudgetMB * 1_000_000;

  const byDay = new Map<string, DayGroup>();
  for (const p of [...photos].reverse()) {
    const day = istDay(p.createdAt);
    if (!byDay.has(day)) byDay.set(day, { day, label: formatWeekdayDate(day), photos: [] });
    byDay.get(day)!.photos.push({
      id: p.id,
      url: p.downloadUrl,
      author: p.authorName,
      createdAt: p.createdAt,
      caption: p.caption,
      hearts: p.hearts,
      ext: p.ext,
      hidden: p.hidden,
    });
  }

  return (
    <div className="min-h-dvh">
      {isDemo && <DemoBanner />}
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-12">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-script text-[22px] font-bold text-ink no-underline hover:text-ink lg:text-[26px]">
            {wedding.monogram}
          </Link>
          <span className="rounded-full bg-sun-100 px-3 py-1 text-sm font-bold">Just you two</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/booth" className="btn btn-sm btn-sea">
            <Icon name="polaroid" size={18} strokeWidth={2} />
            Open the booth
          </Link>
          <Link href="/admin" className="btn btn-sm btn-ghost">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-20 lg:px-12">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="kicker text-xl text-sea-700">Photo Booth</p>
            <h1 className="font-serif text-[30px] leading-tight lg:text-[44px]">Booth control</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {controls.boothPaused && (
              <span role="status" className="rounded-full bg-coral-200 px-3 py-1.5 text-sm font-bold text-coral-800">
                New photos paused
              </span>
            )}
            <form action={setBoothPausedAction}>
              <input type="hidden" name="paused" value={String(!controls.boothPaused)} />
              <button className={cx("btn btn-sm", controls.boothPaused ? "btn-sea" : "btn-outline")}>
                <Icon name={controls.boothPaused ? "play" : "pause"} size={18} strokeWidth={2} />
                {controls.boothPaused ? "Resume new photos" : "Pause new photos"}
              </button>
            </form>
            <Link href="/admin/settings#booth" className="btn btn-sm btn-ghost">
              Times &amp; limits
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid grid-cols-3 gap-2.5">
            <Tile value={photos.length - hidden} label="photos" />
            <Tile value={snappers} label="snappers" />
            <Tile value={hidden} label="hidden" />
          </div>
          <div
            className={cx("flex flex-col gap-2 rounded-[18px] px-4 py-3.5", paused || used > 0.8 ? "bg-coral-200" : "bg-sea-200")}
          >
            <span className="flex justify-between gap-3 text-sm font-bold">
              <span>{size(bytes)} of photos</span>
              <span className="font-semibold text-sea-800">
                {used < 0.01 ? "under 1%" : `${Math.round(used * 100)}%`} of the free 3 GB
              </span>
            </span>
            <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-sand-50">
              <span
                className="block h-full rounded-full bg-sea-700"
                style={{ width: `${Math.min(100, Math.max(2, used * 100))}%` }}
              />
            </span>
            <span className="text-xs text-sea-800">
              {paused
                ? `New photos are paused at the ${lineGB} GB safety line. Archive to Drive below, or upgrade ImageKit (Lite has 10 GB) and raise the line in Site settings.`
                : storageMode === "imagekit"
                ? used > 0.8
                  ? `Getting full: new photos pause at ${lineGB} GB. Archive to Drive below, or upgrade ImageKit (Lite, $9 a month) and raise the line in Site settings.`
                  : "Stored on ImageKit. Viewing is free up to 20 GB a month; ImageKit's dashboard shows how much is used."
                : "Test mode: photos are kept in this server's memory and vanish on restart. Add the ImageKit keys (SETUP.md) to go live."}
            </span>
          </div>
        </section>

        <DriveArchive status={drive} initial={archive} testMode={storageMode !== "imagekit"} flash={flash} />

        <section aria-labelledby="dl-title" className="flex flex-col gap-3">
          <h2 id="dl-title" className="font-serif text-2xl">
            Download a day
          </h2>
          <p className="-mt-1 text-sm text-ink-soft">
            Full-size photos plus a captions.csv, in one ZIP. Includes hidden ones.
            {archive.archived > 0 && " Photos already archived come as their lighter copies; the full-size ones are in Drive."}
          </p>
          <DayDownloads days={[...byDay.values()]} />
        </section>

        <section aria-labelledby="latest-title" className="flex flex-col gap-3">
          <h2 id="latest-title" className="font-serif text-2xl">
            Every photo
          </h2>
          <p className="-mt-1 text-sm text-ink-soft">
            Hiding takes a photo out of the booth for everyone except the person who shared it. Removing a guest on
            the dashboard hides all their photos.
          </p>
          {photos.length ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 lg:gap-3">
              {photos.map((p) => (
                <li key={p.id} className="relative flex flex-col gap-1">
                  <span className="relative block h-32 overflow-hidden rounded-xl bg-sand-200 lg:h-40">
                    <img
                      src={p.thumbUrl}
                      alt={p.caption ? `${p.caption}, by ${p.authorName}` : `Photo by ${p.authorName}`}
                      loading="lazy"
                      className={cx("size-full object-cover", p.hidden && "opacity-25")}
                    />
                    {p.hidden && (
                      <span className="absolute inset-x-0 top-8 flex items-center justify-center gap-1 text-[13px] font-bold">
                        <Icon name="eye-off" size={16} strokeWidth={2} />
                        Hidden
                      </span>
                    )}
                    <form action={togglePhotoHidden} className="absolute inset-x-1.5 bottom-1.5">
                      <input type="hidden" name="photoId" value={p.id} />
                      <input type="hidden" name="hidden" value={p.hidden ? "false" : "true"} />
                      <button
                        className={cx(
                          "h-[34px] w-full rounded-full text-[13px] font-bold",
                          p.hidden ? "bg-ink text-white" : "bg-sand-50/90 text-ink",
                        )}
                        aria-label={p.hidden ? `Show ${p.authorName}'s photo again` : `Hide ${p.authorName}'s photo`}
                      >
                        {p.hidden ? "Show again" : "Hide"}
                      </button>
                    </form>
                  </span>
                  <span className="truncate text-xs font-semibold">
                    {p.authorName} · {p.hearts}♥{p.archived && " · in Drive"}
                  </span>
                  <span className="truncate text-[11px] text-ink-soft">{formatStamp(p.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">No photos yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
