"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useUploads } from "@/components/booth/useUploads";
import { isBusy, uploads } from "@/lib/booth/uploader";
import { cx } from "@/lib/ui";

/** Floating progress card while photos go up. Stays put across pages. */
export function UploadToast() {
  const state = useUploads();
  const pathname = usePathname();
  const sent = state.items.filter((i) => !i.inTray);
  const busy = isBusy(state);
  const done = sent.filter((i) => i.status === "done").length;
  const failed = sent.filter((i) => i.status === "failed");
  const waiting = sent.some((i) => i.status === "waiting") || (!state.online && busy);

  // Warn before leaving the site with photos still on their way.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  // All shared: celebrate briefly, then tidy up.
  useEffect(() => {
    if (busy || failed.length || !done) return;
    const t = setTimeout(() => uploads.clearFinished(), 3500);
    return () => clearTimeout(t);
  }, [busy, failed.length, done]);

  if (!sent.length) return null;

  const total = sent.length;
  const progress = sent.reduce((sum, i) => sum + i.progress, 0) / total;

  let title: string;
  let sub: string;
  if (busy) {
    title = `Sharing ${total === 1 ? "1 photo" : `${total} photos`} · ${done} of ${total} up`;
    sub = waiting ? "Waiting for signal. We'll retry by ourselves." : "Keep scrolling, we've got it.";
  } else if (failed.length) {
    title = done ? `${done} shared, ${failed.length} didn't make it` : `${failed.length === 1 ? "That photo" : "Those photos"} didn't make it`;
    sub = failed[0].error ?? "Something went wrong.";
  } else {
    title = total === 1 ? "Shared! It's in the booth." : `All ${total} shared!`;
    sub = pathname === "/booth" ? "Hearts incoming." : "Tap to see them in the booth.";
  }

  return (
    <div
      role="status"
      className={cx(
        "animate-fade-up fixed inset-x-4 z-40 flex flex-col gap-2.5 rounded-[20px] bg-ink px-3.5 py-3 text-white shadow-[0_10px_24px_rgb(31_58_61/0.25)]",
        pathname === "/rsvp" ? "bottom-[max(1rem,env(safe-area-inset-bottom))]" : "bottom-[calc(96px+env(safe-area-inset-bottom))]",
        "lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[380px]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cx(
            "flex size-[34px] shrink-0 items-center justify-center rounded-full",
            !busy && !failed.length ? "bg-sea-700" : "bg-white/15",
          )}
        >
          <Icon
            name={busy ? (waiting ? "wifi-off" : "send") : failed.length ? "wifi-off" : "check"}
            size={17}
            strokeWidth={2.2}
          />
        </span>
        <span className="flex min-w-0 grow flex-col">
          <span className="text-[15px] font-bold">{title}</span>
          <span className="text-[13px] text-sea-200">{sub}</span>
        </span>
        {!busy && !failed.length && pathname !== "/booth" && (
          <Link href="/booth" className="absolute inset-0 rounded-[20px]" aria-label="Open the Photo Booth" />
        )}
      </div>
      {busy && (
        <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-white/20">
          <span
            className="block h-full rounded-full bg-sun-300 transition-[width] duration-300"
            style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
          />
        </span>
      )}
      {!busy && failed.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => uploads.retryAll()}
            className="min-h-10 rounded-full bg-sun-300 px-4 text-sm font-bold text-ink"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => uploads.clearFinished()}
            className="min-h-10 rounded-full px-3 text-sm font-semibold text-sea-200"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
