"use client";

/* eslint-disable @next/next/no-img-element -- photos come from our CDN already sized */
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { HeartFilled } from "@/components/booth/HeartFilled";
import type { TopScope } from "@/lib/booth/data-types";
import type { FeedPhoto } from "@/lib/booth/types";
import { formatStamp } from "@/lib/format";
import { cx } from "@/lib/ui";
import { describe, who } from "./BoothBits";

const rankLabel: Record<TopScope, string> = { today: "today", yesterday: "yesterday", weekend: "of the weekend" };

/** Full-screen photo: swipe between photos, double-tap to heart, save or share. */
export function PhotoViewer({
  photo,
  index,
  total,
  rank,
  scope,
  hasPrev,
  hasNext,
  onClose,
  onStep,
  onHeart,
  onDelete,
}: {
  photo: FeedPhoto;
  index: number | null;
  total: number;
  rank: number | null;
  scope: TopScope;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onStep: (delta: 1 | -1) => void;
  onHeart: (id: string, onlyAdd?: boolean) => void;
  onDelete: (id: string) => Promise<string | null>;
}) {
  const [burst, setBurst] = useState(0);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [drag, setDrag] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  // Reset per-photo UI when moving to another photo.
  const [shownId, setShownId] = useState(photo.id);
  if (shownId !== photo.id) {
    setShownId(photo.id);
    setMenu(false);
    setConfirming(false);
    setNote(null);
    setDrag(0);
  }

  useEffect(() => {
    closeRef.current?.focus();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && hasNext) onStep(1);
      else if (e.key === "ArrowLeft" && hasPrev) onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep, hasNext, hasPrev]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2200);
    return () => clearTimeout(t);
  }, [note]);

  function likeFromTap() {
    if (photo.mine) return;
    onHeart(photo.id, true);
    setBurst((n) => n + 1);
  }

  const onPointerDown = (e: React.PointerEvent) => {
    gesture.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) g.moved = true;
    if (Math.abs(dx) > Math.abs(dy)) setDrag(dx);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    setDrag(0);
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0 && hasNext) onStep(1);
      if (dx > 0 && hasPrev) onStep(-1);
      return;
    }
    if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      onClose();
      return;
    }
    if (!g.moved) {
      const now = Date.now();
      if (now - lastTap.current < 320) {
        lastTap.current = 0;
        likeFromTap();
      } else {
        lastTap.current = now;
      }
    }
  };

  async function save() {
    setMenu(false);
    try {
      const res = await fetch(photo.downloadUrl);
      const blob = await res.blob();
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const name = `goa-${photo.authorName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${photo.id.slice(0, 6)}.${ext}`;
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setNote("Saved to your downloads");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setNote("Couldn't save it. Press and hold the photo instead.");
    }
  }

  async function share() {
    setMenu(false);
    const url = `${window.location.origin}/booth?photo=${photo.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "From the Photo Booth", text: photo.caption || undefined, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied. Guests only, so it's just for the gang.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setNote("Couldn't share it from here.");
    }
  }

  async function remove() {
    const error = await onDelete(photo.id);
    if (error) {
      setConfirming(false);
      setNote(error);
    }
  }

  const ready = loaded === photo.id;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={describe(photo)}
      className="fixed inset-0 z-50 flex flex-col bg-[#13201F] text-white"
    >
      <div className="flex h-16 shrink-0 items-center justify-between px-3 pt-2 lg:px-6">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-11 items-center justify-center rounded-full bg-white/12"
        >
          <Icon name="close" size={22} strokeWidth={2.2} />
        </button>
        <span className="text-sm font-semibold text-sea-200">{index !== null && total > 0 ? `${index + 1} of ${total}` : ""}</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label="More options"
            aria-expanded={menu}
            className="flex size-11 items-center justify-center rounded-full bg-white/12"
          >
            <Icon name="more" size={22} strokeWidth={2.4} />
          </button>
          {menu && (
            <div className="absolute top-12 right-0 z-10 flex w-52 flex-col overflow-hidden rounded-2xl bg-sand-50 py-1 text-ink shadow-[0_12px_28px_rgb(0_0_0/0.3)]">
              <button type="button" onClick={share} className="flex min-h-12 items-center gap-2.5 px-4 text-left text-[15px] font-semibold">
                <Icon name="copy" size={19} />
                Copy or send link
              </button>
              {photo.mine && (
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setConfirming(true);
                  }}
                  className="flex min-h-12 items-center gap-2.5 px-4 text-left text-[15px] font-semibold text-coral-800"
                >
                  <Icon name="trash" size={19} />
                  Delete my photo
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className="relative mt-1 flex min-h-0 grow touch-pinch-zoom items-center justify-center overflow-hidden select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gesture.current = null;
          setDrag(0);
        }}
      >
        <div
          className="relative size-full transition-transform duration-150"
          style={{ transform: drag ? `translateX(${drag * 0.6}px)` : undefined }}
        >
          <img
            key={`t-${photo.id}`}
            src={photo.thumbUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 size-full object-contain blur-[2px]"
          />
          <img
            key={photo.id}
            src={photo.fullUrl}
            alt={photo.caption || `Photo by ${who(photo)}`}
            draggable={false}
            onLoad={() => setLoaded(photo.id)}
            className={cx(
              "absolute inset-0 size-full object-contain transition-opacity duration-300",
              ready ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
        {burst > 0 && (
          <span key={burst} aria-hidden="true" className="animate-heart-pop pointer-events-none absolute">
            <HeartFilled size={96} />
          </span>
        )}
        {hasPrev && (
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label="Previous photo"
            className="absolute left-4 hidden size-12 items-center justify-center rounded-full bg-white/12 lg:flex"
          >
            <Icon name="arrow-left" size={22} strokeWidth={2.2} />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label="Next photo"
            className="absolute right-4 hidden size-12 items-center justify-center rounded-full bg-white/12 lg:flex"
          >
            <Icon name="arrow-right" size={22} strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-xl shrink-0 flex-col gap-3.5 px-5 pt-4 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2.5">
          <Avatar name={photo.authorName} url={photo.authorAvatar} size={36} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-base font-bold">{who(photo)}</span>
            <span className="text-[13px] text-sea-200">{formatStamp(photo.createdAt)}</span>
          </span>
          {rank && (
            <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-sun-300 px-3 py-1.5 text-[13px] font-bold text-ink">
              <Icon name="crown" size={15} strokeWidth={2.2} />
              No. {rank} {rankLabel[scope]}
            </span>
          )}
        </div>
        {photo.caption && <p className="kicker text-[21px] leading-snug break-words">{photo.caption}</p>}

        {confirming ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-white/8 p-3">
            <p className="text-[15px] font-semibold">Delete this photo for everyone? This can&apos;t be undone.</p>
            <div className="flex gap-2">
              <button type="button" onClick={remove} className="btn btn-sm btn-primary grow">
                Delete
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="btn btn-sm grow bg-white/12 text-white">
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2.5">
            {photo.mine ? (
              <span className="flex h-[54px] grow-[1.3] basis-0 items-center justify-center gap-2 rounded-full bg-white/8 text-[15px] font-bold text-sea-200">
                <HeartFilled size={20} />
                {photo.hearts} {photo.hearts === 1 ? "heart" : "hearts"}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onHeart(photo.id);
                  if (!photo.hearted) setBurst((n) => n + 1);
                }}
                aria-pressed={photo.hearted}
                aria-label={photo.hearted ? "Remove your heart" : "Heart this photo"}
                className={cx(
                  "flex h-[54px] grow-[1.3] basis-0 items-center justify-center gap-2 rounded-full text-[17px] font-bold transition-transform active:scale-95",
                  photo.hearted ? "bg-coral-200 text-coral-600" : "bg-white text-ink",
                )}
              >
                {photo.hearted ? <HeartFilled size={22} /> : <Icon name="heart" size={22} strokeWidth={2} />}
                {photo.hearts}
              </button>
            )}
            <button
              type="button"
              onClick={save}
              className="flex h-[54px] grow basis-0 items-center justify-center gap-1.5 rounded-full bg-white/12 text-[15px] font-semibold"
            >
              <Icon name="download" size={20} strokeWidth={2} />
              Save
            </button>
            <button
              type="button"
              onClick={share}
              className="flex h-[54px] grow basis-0 items-center justify-center gap-1.5 rounded-full bg-white/12 text-[15px] font-semibold"
            >
              <Icon name="share" size={20} strokeWidth={2} />
              Share
            </button>
          </div>
        )}
        <p role="status" className="min-h-4 text-center text-xs text-[#9FB8B4]">
          {note ?? (
            <>
              <span className="lg:hidden">
                {photo.mine ? "Swipe for the next one" : "Double-tap the photo to heart it · swipe for the next one"}
              </span>
              <span className="hidden lg:inline">
                {photo.mine ? "Arrow keys for the next one" : "Double-click the photo to heart it · arrow keys for the next one"}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
