"use client";

/* eslint-disable @next/next/no-img-element -- local previews (blob: URLs) */
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { booth } from "@/content/booth";
import { Icon } from "@/components/Icon";
import { SnapInput } from "@/components/booth/SnapInput";
import { useUploads } from "@/components/booth/useUploads";
import { uploads } from "@/lib/booth/uploader";
import { cx } from "@/lib/ui";

/** The bottom sheet that opens after picking photos: preview, caption, share. */
export function ShareTray() {
  const state = useUploads();
  const tray = state.items.filter((i) => i.inTray);
  const open = state.trayOpen && tray.length > 0;

  if (!open) return null;
  return <Sheet key="tray" tray={tray} trimmed={state.trimmed} />;
}

function Sheet({ tray, trimmed }: { tray: ReturnType<typeof useUploads>["items"]; trimmed: number }) {
  const [caption, setCaption] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const usable = tray.filter((i) => i.status !== "failed");
  const room = booth.maxPerBatch - tray.length;
  // How many more this guest may share, and whether the booth has room (asked once per tray).
  const [allowance, setAllowance] = useState<Allowance | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/booth/feed?allowance=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => live && a && setAllowance(a))
      .catch(() => {}); // offline: the server still enforces the limits
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    titleRef.current?.focus();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && uploads.cancel();
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const blocked = !!allowance && (allowance.full || !!allowance.paused || allowance.left <= 0);
  const n = Math.min(usable.length, allowance?.left ?? Infinity);

  function share() {
    if (!n || blocked) return;
    uploads.share(caption, n);
    if (pathname !== "/booth") router.push("/booth");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button
        type="button"
        aria-label="Cancel sharing"
        tabIndex={-1}
        onClick={() => uploads.cancel()}
        className="absolute inset-0 cursor-default bg-ink/50"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="animate-fade-up relative flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-sand-50 px-5 pt-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_rgb(31_58_61/0.18)] lg:max-w-[440px] lg:rounded-[28px] lg:pt-6"
      >
        <span aria-hidden="true" className="h-[5px] w-11 self-center rounded-full bg-sand-300 lg:hidden" />
        <div className="flex flex-col gap-0.5">
          <p className="kicker text-xl text-coral-600">{n ? "Looking good!" : "Hmm…"}</p>
          <h2 id="share-title" ref={titleRef} tabIndex={-1} className="font-serif text-[28px] leading-[1.1] outline-none">
            {blocked ? "Hold that thought" : n === 1 ? "Share 1 photo" : `Share ${n} photos`}
          </h2>
        </div>

        <ul aria-label="Selected photos" className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
          {tray.map((it, i) => (
            <li key={it.key} className="relative h-24 w-[76px] shrink-0 overflow-hidden rounded-[14px] bg-sand-200">
              {it.preview ? (
                <img src={it.preview} alt={`Selected photo ${i + 1}`} className="size-full object-cover" />
              ) : it.status === "failed" ? null : (
                <span className="block size-full animate-pulse bg-sand-300/60" aria-label="Getting it ready" />
              )}
              {it.status === "failed" && (
                <span className="absolute inset-0 flex items-center justify-center bg-coral-200 p-1.5 text-center text-[11px] leading-tight font-bold text-coral-800">
                  Can&apos;t read this one
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => uploads.remove(it.key)}
                className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-ink/70 text-white"
              >
                <Icon name="close" size={14} strokeWidth={2.4} />
              </button>
            </li>
          ))}
          {room > 0 && (
            <li className="shrink-0">
              <SnapInput
                label="Add more photos"
                className="flex h-24 w-[76px] flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed border-sand-300 bg-sand-100 text-[13px] font-semibold text-ink-soft"
              >
                <Icon name="plus" size={22} strokeWidth={2} />
                Add
              </SnapInput>
            </li>
          )}
        </ul>
        {trimmed > 0 && (
          <p className="-mt-2 text-sm font-semibold text-coral-800">
            {booth.maxPerBatch} at a time, so we left {trimmed === 1 ? "one" : trimmed} out. Share {trimmed === 1 ? "it" : "them"} next.
          </p>
        )}
        {allowance && <AllowanceNote allowance={allowance} picked={usable.length} />}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="share-caption" className="text-sm font-bold">
            Caption <span className="font-medium text-ink-soft">(optional{n > 1 ? ", goes on all of them" : ""})</span>
          </label>
          <input
            id="share-caption"
            type="text"
            maxLength={booth.captionMax}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && share()}
            placeholder="Say something nice…"
            enterKeyHint="send"
            autoComplete="off"
            className="field text-base"
          />
        </div>

        <p className="flex items-start gap-2 text-[13px] leading-snug text-ink-soft">
          <Icon name="wifi" size={17} strokeWidth={1.9} className="mt-px shrink-0" />
          We shrink them to under 1 MB each first, still sharp. If the Wi-Fi drops, we keep trying on our own.
        </p>

        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={share} disabled={!n || blocked} className={cx("btn btn-primary w-full")}>
            <Icon name="send" size={19} strokeWidth={2} />
            Share to the booth
          </button>
          <button
            type="button"
            onClick={() => uploads.cancel()}
            className="min-h-11 text-[15px] font-semibold text-ink-soft"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

type Allowance = { left: number; max: number; full: boolean; paused?: boolean };

function AllowanceNote({ allowance: { left, max, full, paused }, picked }: { allowance: Allowance; picked: number }) {
  let text: string | null = null;
  if (paused) text = "New photos are paused for a little while. Try again soon!";
  else if (full) text = "The booth is full for now. Let the couple know and they'll make room.";
  else if (left <= 0) text = `You've shared ${max} photos, the most per guest. Delete a few from Mine to share more.`;
  else if (picked > left) text = `You can share ${left} more, so we'll send the first ${left}.`;
  else if (left - picked <= 15) text = `After these you'll have ${left - picked} left (${max} each).`;
  if (!text) return null;
  const stop = paused || full || left <= 0;
  return (
    <p
      role="status"
      className={cx("-mt-2 rounded-xl px-3 py-2 text-sm font-semibold", stop ? "bg-coral-200 text-coral-800" : "bg-sun-100 text-ink")}
    >
      {text}
    </p>
  );
}
