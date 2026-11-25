"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import type { DriveStatus } from "@/lib/google-drive-types";
import { cx } from "@/lib/ui";
import { archiveBatchAction, disconnectDriveAction } from "../actions";

type Counts = { archived: number; waiting: number };

/** Booth control's "Archive to Google Drive" card. */
export function DriveArchive({
  status,
  initial,
  testMode,
  flash,
}: {
  status: DriveStatus;
  initial: Counts;
  testMode: boolean;
  flash: { ok: boolean; text: string } | null;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState(initial);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState(false);
  const stop = useRef(false);

  // Don't let the tab close quietly halfway (nothing is lost, but it stops).
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function run() {
    setRunning(true);
    setError(null);
    stop.current = false;
    const total = counts.waiting;
    let done = 0;
    setProgress({ done, total });
    for (;;) {
      let res: Awaited<ReturnType<typeof archiveBatchAction>>;
      try {
        res = await archiveBatchAction();
      } catch {
        setError("Lost the connection. Press Archive again to carry on; nothing is lost.");
        break;
      }
      if (!res.ok) {
        setError(res.error);
        setReconnect(!!res.reconnect);
        break;
      }
      done += res.done;
      setCounts({ archived: res.archived, waiting: res.waiting });
      setProgress({ done, total: Math.max(total, done + res.waiting) });
      if (res.waiting === 0) break;
      if (res.done === 0) {
        setError(`${res.errors[0] ?? "Archiving got stuck."} Press Archive to try again.`);
        break;
      }
      if (stop.current) break;
    }
    setRunning(false);
    router.refresh();
  }

  const heading = (
    <div className="flex flex-col gap-1">
      <h2 id="drive-title" className="flex items-center gap-2 font-serif text-2xl">
        Archive to Google Drive
      </h2>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
        Full-size originals go to a <b>Wedding Photo Booth</b> folder in your Drive, one folder per day. The booth
        keeps a lighter copy (1280px, still sharp on any phone), so guests won&apos;t notice, and ImageKit gets back
        about 70% of the space. Use it any time, or whenever Booth control turns coral.
      </p>
    </div>
  );

  return (
    <section aria-labelledby="drive-title" className="card flex flex-col gap-4 rounded-[28px] p-5 lg:p-7">
      {heading}

      {flash && (
        <p
          role="status"
          className={cx("rounded-xl px-3 py-2 text-sm font-semibold", flash.ok ? "bg-sea-200 text-sea-800" : "bg-coral-200 text-coral-800")}
        >
          {flash.text}
        </p>
      )}

      {status.state === "off" && (
        <p className="text-sm text-ink-soft">
          Not set up yet: add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> (SETUP.md, step 9),
          then come back here to connect your Drive.
        </p>
      )}

      {status.state === "disconnected" && (
        <a href="/admin/drive/connect" className="btn btn-sm btn-sea self-start">
          <Icon name="plus" size={18} strokeWidth={2} />
          Connect Google Drive
        </a>
      )}

      {(status.state === "broken" || (reconnect && status.state === "connected")) && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-coral-800">
            Drive was disconnected ({status.email}). Reconnect to keep archiving; everything already in Drive stays put.
          </p>
          <a href="/admin/drive/connect" className="btn btn-sm btn-sea self-start">
            Reconnect Google Drive
          </a>
        </div>
      )}

      {status.state === "connected" && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold">Connected to {status.email}</span>
            {status.folderUrl && (
              <a href={status.folderUrl} target="_blank" rel="noreferrer" className="font-semibold">
                Open the Drive folder
              </a>
            )}
            <form action={disconnectDriveAction}>
              <button className="font-semibold text-ink-soft underline-offset-2 hover:underline" disabled={running}>
                Disconnect
              </button>
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-sm btn-primary" disabled={running || counts.waiting === 0} onClick={run}>
              <Icon name="download" size={18} strokeWidth={2} />
              {running
                ? "Archiving…"
                : counts.waiting === 0
                  ? "Everything's in Drive"
                  : `Archive ${counts.waiting} ${counts.waiting === 1 ? "photo" : "photos"} to Drive`}
            </button>
            {running && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => (stop.current = true)}>
                Pause
              </button>
            )}
            <span className="text-sm text-ink-soft">
              {counts.archived} in Drive · {counts.waiting} not yet
            </span>
          </div>

          {progress && (running || progress.done > 0) && (
            <div className="flex flex-col gap-1.5" aria-live="polite">
              <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-sand-200">
                <span
                  className="block h-full rounded-full bg-sea-700 transition-[width] duration-300"
                  style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 100}%` }}
                />
              </span>
              <span className="text-sm font-semibold">
                {running
                  ? `Archiving… ${progress.done} of ${progress.total}. Keep this tab open.`
                  : `Done: ${progress.done} ${progress.done === 1 ? "photo" : "photos"} moved to Drive.`}
              </span>
            </div>
          )}
          {testMode && (
            <p className="text-xs text-ink-soft">
              Test mode: photos are copied to Drive, but there&apos;s no ImageKit yet to make the lighter copies.
            </p>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-coral-800">
          {error}
        </p>
      )}
    </section>
  );
}
