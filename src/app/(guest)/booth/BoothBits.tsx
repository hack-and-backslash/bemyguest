"use client";

/* eslint-disable @next/next/no-img-element -- photos come from our CDN already sized; no need to re-optimise */
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { HeartFilled } from "@/components/booth/HeartFilled";
import type { TopScope } from "@/lib/booth/data-types";
import type { FeedPhoto, TopPhoto } from "@/lib/booth/types";
import { uploads, type UploadItem } from "@/lib/booth/uploader";
import { cx } from "@/lib/ui";

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** A gentle, stable tilt per photo, like prints pinned to a board. */
export const tilt = (id: string) => ((hash(id) % 33) - 16) / 10;

export const who = (p: FeedPhoto) => (p.mine ? "You" : p.authorName);

export function describe(p: FeedPhoto) {
  return p.caption ? `${p.caption}, by ${who(p)}` : `Photo by ${who(p)}`;
}

/* ───────────────────────── grid card ───────────────────────── */

export function Polaroid({
  photo,
  onOpen,
  onHeart,
}: {
  photo: FeedPhoto;
  onOpen: () => void;
  onHeart: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-[7px] rounded-md bg-white px-1.5 pt-1.5 pb-2 shadow-[0_6px_16px_rgb(31_58_61/0.12)] transition-transform duration-300 ease-soft hover:-translate-y-1"
      style={{ rotate: `${tilt(photo.id)}deg` }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open: ${describe(photo)}, ${photo.hearts} ${photo.hearts === 1 ? "heart" : "hearts"}`}
        className="relative block aspect-[4/5] overflow-hidden rounded-[3px] bg-sand-200"
      >
        <img
          src={photo.thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          width={photo.width}
          height={photo.height}
          className="size-full object-cover"
        />
        {photo.hidden && (
          <span className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-full bg-ink/80 px-2 py-1 text-[11px] font-bold text-white">
            <Icon name="eye-off" size={13} strokeWidth={2} />
            Only you can see this
          </span>
        )}
      </button>
      <div className="flex min-w-0 items-center gap-1.5 px-0.5">
        <Avatar name={photo.authorName} url={photo.authorAvatar} size={22} />
        <span className="grow truncate text-[13px] font-bold">{who(photo)}</span>
        <HeartButton photo={photo} onHeart={onHeart} />
      </div>
    </div>
  );
}

function HeartButton({ photo, onHeart }: { photo: FeedPhoto; onHeart: () => void }) {
  const content = (
    <>
      {photo.hearted ? <HeartFilled size={15} /> : <Icon name="heart" size={15} strokeWidth={2} />}
      {photo.hearts}
    </>
  );
  if (photo.mine) {
    return (
      <span className="flex items-center gap-[3px] text-[13px] font-bold text-ink-soft" aria-label={`${photo.hearts} hearts`}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onHeart}
      aria-pressed={photo.hearted}
      aria-label={`Heart ${who(photo)}'s photo (${photo.hearts})`}
      className={cx(
        "-my-2 -mr-1.5 flex h-10 items-center gap-[3px] rounded-full px-1.5 text-[13px] font-bold transition-transform active:scale-90",
        photo.hearted ? "text-coral-600" : "text-ink-soft",
      )}
    >
      {content}
    </button>
  );
}

/* ───────────────────────── uploads in flight ───────────────────────── */

function Ring({ value }: { value: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" role="img" aria-label={`${Math.round(value * 100)}% uploaded`}>
      <circle cx="27" cy="27" r={r} fill="none" stroke="rgb(255 255 255 / .35)" strokeWidth="5" />
      <circle
        cx="27"
        cy="27"
        r={r}
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(c * Math.max(0.03, value)).toFixed(1)} ${c.toFixed(1)}`}
        transform="rotate(-90 27 27)"
        className="transition-[stroke-dasharray] duration-300"
      />
    </svg>
  );
}

export function PendingPolaroid({ item }: { item: UploadItem }) {
  let overlay: React.ReactNode;
  if (item.status === "waiting") {
    overlay = (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink/55 px-3 text-center text-white">
        <Icon name="wifi-off" size={26} strokeWidth={2} />
        <span className="text-[13px] leading-tight font-bold">Waiting for signal</span>
        <span className="text-xs leading-tight">We&apos;ll retry by ourselves</span>
      </span>
    );
  } else if (item.status === "failed") {
    overlay = (
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/70 px-2.5 text-center text-white">
        <span className="text-xs leading-tight font-bold">{item.error ?? "Didn't make it"}</span>
        <span className="flex gap-1.5">
          <button
            type="button"
            onClick={() => uploads.retry(item.key)}
            className="min-h-9 rounded-full bg-sun-300 px-3 text-xs font-bold text-ink"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => uploads.dismiss(item.key)}
            aria-label="Remove"
            className="flex size-9 items-center justify-center rounded-full bg-white/15"
          >
            <Icon name="close" size={14} strokeWidth={2.4} />
          </button>
        </span>
      </span>
    );
  } else {
    overlay = (
      <span className="absolute inset-0 flex items-center justify-center bg-ink/40">
        <Ring value={item.progress} />
      </span>
    );
  }
  return (
    <div
      className="flex flex-col gap-[7px] rounded-md bg-white px-1.5 pt-1.5 pb-2 shadow-[0_6px_16px_rgb(31_58_61/0.12)]"
      style={{ rotate: `${tilt(item.key)}deg` }}
    >
      <span className="relative block aspect-[4/5] overflow-hidden rounded-[3px] bg-sand-200">
        {item.preview ? (
          <img src={item.preview} alt="Your photo, on its way" className="size-full object-cover" />
        ) : (
          <span className="block size-full animate-pulse bg-sand-300/60" />
        )}
        {overlay}
      </span>
      <span className="flex items-center gap-1.5 px-0.5 text-[13px] font-bold">
        <span className="grow truncate">You</span>
        <span className="font-semibold text-ink-soft">
          {item.status === "failed" ? "" : item.status === "waiting" ? "paused" : item.status === "saving" ? "almost…" : "sending"}
        </span>
      </span>
    </div>
  );
}

/* ───────────────────────── top 3 ───────────────────────── */

const scopeTitle: Record<TopScope, string> = {
  today: "Today's top 3",
  yesterday: "Yesterday's top 3",
  weekend: "Best of the weekend",
};

const badge = { 1: "bg-sun-300", 2: "bg-sky-200", 3: "bg-coral-200" } as const;

export function Podium({
  scope,
  photos,
  onOpen,
}: {
  scope: TopScope;
  photos: TopPhoto[];
  onOpen: (id: string) => void;
}) {
  const cells = ([2, 1, 3] as const).map((rank) => ({ rank, photo: photos.find((p) => p.rank === rank) }));
  return (
    <section
      aria-labelledby="top3-title"
      className="animate-fade-up flex flex-col gap-3.5 rounded-3xl bg-sun-100 px-2.5 pt-3 pb-3.5 lg:px-6 lg:pt-5 lg:pb-6"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id="top3-title" className="flex items-center gap-1.5 font-serif text-[19px] whitespace-nowrap lg:text-2xl">
          <Icon name="crown" size={18} strokeWidth={2} />
          {scopeTitle[scope]}
        </h2>
        <span className="text-xs font-semibold text-[#6B5A2E]">one photo each</span>
      </div>
      <ol className="flex items-end justify-center gap-2 lg:gap-5">
        {cells.map(({ rank, photo }) => (
          <li
            key={rank}
            className={cx("relative shrink-0", rank === 1 ? "w-[124px] lg:w-[184px]" : "w-24 lg:w-[140px]")}
            style={{ rotate: `${rank === 1 ? -1 : rank === 2 ? -4 : 4}deg` }}
          >
            <span
              aria-hidden="true"
              className={cx(
                "absolute -top-[11px] -left-[9px] z-[1] flex size-[30px] items-center justify-center rounded-full border-2 border-white font-serif text-[15px] shadow-[0_3px_8px_rgb(31_58_61/0.18)]",
                badge[rank],
              )}
            >
              {rank === 1 ? <Icon name="crown" size={16} strokeWidth={2.2} /> : rank}
            </span>
            {photo ? (
              <button
                type="button"
                onClick={() => onOpen(photo.id)}
                aria-label={`Number ${rank}: ${describe(photo)}, ${photo.hearts} hearts`}
                className="flex w-full flex-col gap-[5px] rounded-md bg-white px-[5px] pt-[5px] pb-[7px] text-left shadow-[0_6px_16px_rgb(31_58_61/0.14)] transition-transform duration-300 ease-soft hover:-translate-y-1"
              >
                <span
                  className={cx(
                    "block overflow-hidden rounded-[3px] bg-sand-200",
                    rank === 1 ? "h-[140px] lg:h-[210px]" : "h-[104px] lg:h-[156px]",
                  )}
                >
                  <img src={photo.thumbUrl} alt="" className="size-full object-cover" />
                </span>
                <span className="flex items-center gap-1 px-px text-xs font-bold">
                  <span className="grow truncate">{who(photo)}</span>
                  <span className="flex items-center gap-0.5 text-coral-600">
                    <HeartFilled size={13} />
                    {photo.hearts}
                  </span>
                </span>
              </button>
            ) : (
              <span className="flex w-full flex-col gap-[5px] rounded-md bg-white/70 px-[5px] pt-[5px] pb-[7px]">
                <span
                  className={cx(
                    "flex items-center justify-center rounded-[3px] border-2 border-dashed border-sand-300 text-[#9C7650]",
                    rank === 1 ? "h-[140px] lg:h-[210px]" : "h-[104px] lg:h-[156px]",
                  )}
                >
                  <Icon name="heart" size={rank === 1 ? 28 : 22} strokeWidth={1.6} />
                </span>
                <span className="kicker px-px text-center text-[13px] text-[#9C7650]">up for grabs</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      {photos.length === 0 && (
        <p className="px-2 text-center text-[13px] leading-snug font-semibold text-[#6B5A2E]">
          No hearts yet. Double-tap your favourites to crown the top 3.
        </p>
      )}
    </section>
  );
}
