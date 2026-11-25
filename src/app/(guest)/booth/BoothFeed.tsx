"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SnapInput } from "@/components/booth/SnapInput";
import { useUploads } from "@/components/booth/useUploads";
import type { TopThree } from "@/lib/booth/data-types";
import type { BoothStats, FeedPage, FeedPhoto } from "@/lib/booth/types";
import { uploads } from "@/lib/booth/uploader";
import { cx } from "@/lib/ui";
import { deletePhotoAction, toggleHeartAction } from "./actions";
import { PendingPolaroid, Podium, Polaroid } from "./BoothBits";
import { PhotoViewer } from "./PhotoViewer";

type Tab = "all" | "mine";
const POLL_MS = 20_000;

/** Remember the newest photo we've shown, so polling only counts ones after it. */
function markSeen(ref: { current: string }, list: FeedPhoto[]) {
  for (const p of list) if (p.createdAt > ref.current) ref.current = p.createdAt;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function BoothFeed({
  phase,
  initial,
  initialStats,
  initialTop,
  initialMine,
  initialPhoto,
  loadedAt,
}: {
  phase: "open" | "closed";
  initial: FeedPage;
  initialStats: BoothStats;
  initialTop: TopThree;
  initialMine: number;
  initialPhoto: FeedPhoto | null;
  loadedAt: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [photos, setPhotos] = useState(initial.photos);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(initialStats);
  const [top, setTop] = useState(initialTop);
  const [mineCount, setMineCount] = useState(initialMine);
  const [newer, setNewer] = useState(0);
  const [extra, setExtra] = useState<FeedPhoto | null>(initialPhoto);
  const [openFrom, setOpenFrom] = useState<"grid" | "top">("grid");
  const [error, setError] = useState<string | null>(null);

  const upload = useUploads();
  const pending = upload.items.filter((i) => !i.inTray && i.status !== "done");

  const params = useSearchParams();
  const pathname = usePathname();
  const openId = params.get("photo");
  const pushed = useRef(false);
  const request = useRef(0);
  const gridTop = useRef<HTMLDivElement>(null);
  const newest = useRef(initial.photos[0]?.createdAt ?? loadedAt);
  const mineRef = useRef(initialMine);

  /* ── loading pages ── */

  const load = useCallback(async (which: Tab, after: string | null) => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (which === "mine") q.set("mine", "1");
      if (after) q.set("cursor", after);
      const res = await fetch(`/booth/feed?${q}`, { cache: "no-store" });
      const data = (await res.json()) as FeedPage & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't load photos.");
      if (id !== request.current) return;
      setPhotos((prev) => {
        const base = after ? prev : [];
        const ids = new Set(base.map((p) => p.id));
        return [...base, ...data.photos.filter((p) => !ids.has(p.id))];
      });
      setCursor(data.nextCursor);
      if (which === "all") markSeen(newest, data.photos);
    } catch (e) {
      if (id === request.current) setError(e instanceof Error ? e.message : "Couldn't load photos.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  function switchTab(next: Tab) {
    if (next === tab) return;
    setTab(next);
    setPhotos([]);
    setCursor(null);
    void load(next, null);
  }

  async function showNewer() {
    setNewer(0);
    if (tab !== "all") setTab("all");
    await load("all", null);
    gridTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Infinite scroll.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || loading) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void load(tab, cursor), {
      rootMargin: "800px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loading, tab, load]);

  // Live: new-photo count, stats and top 3, every 20 s while the page is on screen.
  useEffect(() => {
    if (phase !== "open") return;
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const res = await fetch(`/booth/feed?poll=${encodeURIComponent(newest.current)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { newer: number; stats: BoothStats; top: TopThree };
        setNewer(data.newer);
        setStats(data.stats);
        setTop(data.top);
      } catch {
        // Offline for a moment: try again on the next tick.
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase]);

  // My own photos pop in as soon as they land.
  useEffect(
    () =>
      uploads.onDone((photo) => {
        const first = mineRef.current === 0;
        mineRef.current += 1;
        setPhotos((prev) => (prev.some((p) => p.id === photo.id) ? prev : [photo, ...prev]));
        setMineCount(mineRef.current);
        setStats((s) => ({ photos: s.photos + 1, snappers: s.snappers + (first ? 1 : 0) }));
        markSeen(newest, [photo]);
      }),
    [],
  );

  /* ── hearts & deleting ── */

  const find = (id: string) =>
    photos.find((p) => p.id === id) ?? top.photos.find((p) => p.id === id) ?? (extra?.id === id ? extra : undefined);

  const update = (id: string, change: Partial<FeedPhoto>) => {
    setPhotos((list) => list.map((p) => (p.id === id ? { ...p, ...change } : p)));
    setTop((t) => ({ ...t, photos: t.photos.map((p) => (p.id === id ? { ...p, ...change } : p)) }));
    setExtra((p) => (p?.id === id ? { ...p, ...change } : p));
  };

  async function heart(id: string, onlyAdd = false) {
    const p = find(id);
    if (!p || p.mine || (onlyAdd && p.hearted)) return;
    const before = { hearted: p.hearted, hearts: p.hearts };
    update(id, { hearted: !p.hearted, hearts: p.hearts + (p.hearted ? -1 : 1) });
    try {
      const res = await toggleHeartAction(id);
      update(id, res.ok ? { hearted: res.hearted, hearts: res.hearts } : before);
    } catch {
      update(id, before);
    }
  }

  async function remove(id: string): Promise<string | null> {
    try {
      const res = await deletePhotoAction(id);
      if (!res.ok) return res.error;
    } catch {
      return "Couldn't delete it. Check your signal and try again.";
    }
    const wasVisible = !find(id)?.hidden;
    setPhotos((list) => list.filter((p) => p.id !== id));
    setTop((t) => ({ ...t, photos: t.photos.filter((p) => p.id !== id) }));
    mineRef.current = Math.max(0, mineRef.current - 1);
    setMineCount(mineRef.current);
    if (wasVisible) setStats((s) => ({ ...s, photos: Math.max(0, s.photos - 1) }));
    close();
    return null;
  }

  /* ── the photo viewer, kept in the URL (?photo=…) so Back closes it ── */

  const sequence = openFrom === "top" ? top.photos : photos;
  const openIndex = openId ? sequence.findIndex((p) => p.id === openId) : -1;
  const open = openId ? (sequence[openIndex] ?? find(openId) ?? null) : null;

  // A shared link to a photo that isn't loaded yet.
  useEffect(() => {
    if (!openId || find(openId)) return;
    let live = true;
    fetch(`/booth/feed?photo=${encodeURIComponent(openId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { photo?: FeedPhoto } | null) => live && data?.photo && setExtra(data.photo))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the requested photo changes
  }, [openId]);

  function openPhoto(id: string, from: "grid" | "top") {
    setOpenFrom(from);
    window.history.pushState(null, "", `${pathname}?photo=${encodeURIComponent(id)}`);
    pushed.current = true;
  }

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", pathname);
    }
  }, [pathname]);

  const step = useCallback(
    (delta: 1 | -1) => {
      if (openIndex < 0) return;
      const next = sequence[openIndex + delta];
      if (!next) return;
      window.history.replaceState(null, "", `${pathname}?photo=${encodeURIComponent(next.id)}`);
      if (openFrom === "grid" && delta === 1 && openIndex + 4 >= sequence.length && cursor && !loading) {
        void load(tab, cursor);
      }
    },
    [openIndex, sequence, pathname, openFrom, cursor, loading, load, tab],
  );

  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const rank = useMemo(() => (open ? (top.photos.find((p) => p.id === open.id)?.rank ?? null) : null), [open, top]);

  const total = openFrom === "top" ? top.photos.length : tab === "mine" ? mineCount : stats.photos;
  const empty = !loading && !photos.length && !pending.length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-12 lg:px-8">
      <section className="flex items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-serif text-[30px] leading-[1.1] lg:text-5xl">Photo Booth</h1>
          <p className="text-sm font-semibold text-ink-soft lg:text-base">
            {stats.photos
              ? `${plural(stats.photos, "photo", "photos")} · ${plural(stats.snappers, "snapper", "snappers")}`
              : phase === "open"
                ? "Fresh film loaded. Be the first!"
                : "No photos yet."}
          </p>
        </div>
        <div className="mb-1 flex shrink-0 items-center gap-3">
          {phase === "open" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-coral-200 px-2.5 py-[5px] text-xs font-bold tracking-[0.06em] text-coral-800 uppercase">
              <span className="animate-live size-2 rounded-full bg-coral-600" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-sea-200 px-2.5 py-[5px] text-xs font-bold tracking-[0.06em] text-sea-800 uppercase">
              <Icon name="polaroid" size={14} strokeWidth={2} />
              The album
            </span>
          )}
          {phase === "open" && (
            <SnapInput label="Share photos" className="btn btn-sm btn-primary hidden lg:inline-flex">
              <Icon name="camera" size={20} strokeWidth={2} />
              Share photos
            </SnapInput>
          )}
        </div>
      </section>

      <div className="mt-3 lg:mt-6">
        <Podium scope={top.scope} photos={top.photos} onOpen={(id) => openPhoto(id, "top")} />
      </div>

      <div role="group" aria-label="Show" className="mt-3.5 flex gap-2 lg:mt-6">
        {(["all", "mine"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => switchTab(t)}
            className={cx(
              "h-10 rounded-full px-4 text-sm transition-colors",
              tab === t ? "bg-ink font-bold text-white" : "border-[1.5px] border-sand-300 bg-sand-50 font-semibold text-ink",
            )}
          >
            {t === "all" ? "Everyone" : `Mine · ${mineCount}`}
          </button>
        ))}
      </div>

      <div ref={gridTop} className="relative mt-4 scroll-mt-20">
        {newer > 0 && (
          <button
            type="button"
            onClick={showNewer}
            className="animate-fade-up sticky top-3 z-10 mx-auto -mb-10 flex h-[38px] items-center gap-1.5 rounded-full bg-sea-700 px-4 text-sm font-bold text-white shadow-[0_8px_18px_rgb(31_122_107/0.35)]"
          >
            <Icon name="arrow-up" size={16} strokeWidth={2.2} />
            {plural(newer, "new photo", "new photos")}
          </button>
        )}

        {empty ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p className="kicker text-2xl text-coral-600">{tab === "mine" ? "Nothing yet" : "Blank film"}</p>
            <p className="max-w-sm text-base text-ink-soft">
              {phase === "open"
                ? tab === "mine"
                  ? "Your photos will show up here. The airport selfie counts!"
                  : "No photos yet. Yours could be the very first one."
                : "No photos here."}
            </p>
            {phase === "open" && (
              <SnapInput label="Share photos" className="btn btn-sm btn-primary mt-1">
                <Icon name="camera" size={20} strokeWidth={2} />
                Share photos
              </SnapInput>
            )}
          </div>
        ) : (
          <ul aria-label="Photos" className="grid grid-cols-2 gap-x-3.5 gap-y-[18px] pt-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-8">
            {pending.map((item) => (
              <li key={item.key}>
                <PendingPolaroid item={item} />
              </li>
            ))}
            {photos.map((p) => (
              <li key={p.id}>
                <Polaroid photo={p} onOpen={() => openPhoto(p.id, "grid")} onHeart={() => heart(p.id)} />
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-6 text-center text-sm font-semibold text-coral-800">
            {error}{" "}
            <button type="button" className="underline" onClick={() => load(tab, photos.length ? cursor : null)}>
              Try again
            </button>
          </p>
        )}
        {loading && (
          <p className="mt-6 text-center text-sm font-semibold text-ink-soft" aria-live="polite">
            Developing…
          </p>
        )}
        <div ref={sentinel} aria-hidden="true" className="h-px" />
        {!cursor && !loading && photos.length > 8 && (
          <p className="kicker mt-8 text-center text-lg text-ink-soft">That&apos;s the whole roll!</p>
        )}
      </div>

      {open && (
        <PhotoViewer
          photo={open}
          index={openIndex >= 0 ? openIndex : null}
          total={total}
          rank={rank}
          scope={top.scope}
          hasPrev={openIndex > 0}
          hasNext={openIndex >= 0 && openIndex < sequence.length - 1}
          onClose={close}
          onStep={step}
          onHeart={heart}
          onDelete={remove}
        />
      )}
    </div>
  );
}
