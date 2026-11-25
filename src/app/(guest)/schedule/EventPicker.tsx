"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { DayId, IconName, Tint } from "@/content/wedding";
import { Icon } from "@/components/Icon";
import type { CalendarLinks } from "@/components/CalendarButtons";
import { HOUR, IST_OFFSET_MS, istHour, skyAt, timeOfDayLabel } from "@/lib/sky";
import { cx, tintBg } from "@/lib/ui";
import { SkyScene } from "./SkyScene";

export type TLEvent = {
  id: string;
  day: DayId;
  title: string;
  icon: IconName;
  tint: Tint;
  start: number;
  end: number | null;
  timeLabel: string;
  venue: string;
  mapsUrl: string | null;
  blurb: string;
  meal: boolean;
  highlight: boolean;
  calendar: CalendarLinks | null;
};

export type TLDay = {
  id: DayId;
  label: string;
  dateLabel: string;
  summary: string;
  extra: boolean;
  axisStart: number;
  axisEnd: number;
  events: TLEvent[];
};

type Mode = "auto" | "manual" | "live";

const capsuleFill: Record<Tint, string> = {
  sun: "bg-sun-100/90",
  sky: "bg-sky-200/90",
  coral: "bg-coral-200/90",
  sea: "bg-sea-200/90",
  palm: "bg-palm-100/90",
  sand: "bg-sand-200/90",
};

/** "4:30 PM" in IST, rounded to `step` minutes. Deterministic on server and client. */
function clock(ms: number, step = 5) {
  let mins = Math.round((ms + IST_OFFSET_MS) / 60_000 / step) * step;
  mins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h % 12 || 12;
  const ap = h < 12 ? "AM" : "PM";
  return m ? `${h12}:${String(m).padStart(2, "0")} ${ap}` : `${h12} ${ap}`;
}

const endOf = (e: TLEvent) => e.end ?? e.start + HOUR;

function activeAt(events: TLEvent[], ms: number) {
  return events.filter((e) => e.start <= ms && ms < endOf(e));
}

function focusAt(events: TLEvent[], ms: number) {
  const active = activeAt(events, ms);
  if (active.length) return active.find((e) => e.highlight) ?? active[active.length - 1];
  return events.find((e) => e.start > ms) ?? events[events.length - 1];
}

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function tweenMs(from: number, to: number) {
  return Math.min(3200, Math.max(900, 900 + (Math.abs(to - from) / HOUR) * 260));
}

export function EventPicker({
  days,
  sun,
  previewAt,
}: {
  days: TLDay[];
  sun: { rise: number; set: number };
  /** The couple's "preview the site as a date" moment, if they're previewing. */
  previewAt: number | null;
}) {
  const mainDays = days.filter((d) => !d.extra);
  const extraDay = days.find((d) => d.extra);

  const firstFocus = (d: TLDay) => d.events.find((e) => e.highlight) ?? d.events[0];

  const [dayId, setDayId] = useState<DayId>(days[0].id);
  const [t, setT] = useState(() => firstFocus(days[0]).start);
  const [selectedId, setSelectedIdState] = useState(() => firstFocus(days[0]).id);
  /** null until the guest takes over; then "live" follows the clock during the wedding. */
  const [userMode, setUserMode] = useState<Mode | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const [size, setSize] = useState({ w: 1216, h: 560 });
  const [trackW, setTrackW] = useState(900);
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const isNarrow = useMedia("(max-width: 1023px)");

  const tRef = useRef(t);
  const rafRef = useRef(0);
  const selectedRef = useRef(selectedId);
  const reducedRef = useRef(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const setSelected = useCallback((id: string) => {
    selectedRef.current = id;
    setSelectedIdState(id);
  }, []);

  const jump = useCallback((v: number) => {
    cancelAnimationFrame(rafRef.current);
    tRef.current = v;
    setT(v);
  }, []);

  const tweenTo = useCallback(
    (target: number, ms?: number) =>
      new Promise<void>((resolve) => {
        cancelAnimationFrame(rafRef.current);
        const from = tRef.current;
        const dur = ms ?? tweenMs(from, target);
        if (reducedRef.current || from === target) {
          tRef.current = target;
          setT(target);
          resolve();
          return;
        }
        const t0 = performance.now();
        const step = (nowTs: number) => {
          const k = Math.min(1, (nowTs - t0) / dur);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          const v = from + (target - from) * e;
          tRef.current = v;
          setT(v);
          if (k < 1) rafRef.current = requestAnimationFrame(step);
          else resolve();
        };
        rafRef.current = requestAnimationFrame(step);
      }),
    [],
  );

  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  // Sizes and visibility.
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (sceneRef.current) setSize({ w: sceneRef.current.clientWidth, h: sceneRef.current.clientHeight });
      if (trackRef.current) setTrackW(trackRef.current.clientWidth);
    });
    if (sceneRef.current) ro.observe(sceneRef.current);
    if (trackRef.current) ro.observe(trackRef.current);

    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    if (sceneRef.current) io.observe(sceneRef.current);

    return () => {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Live clock: during the wedding the sky and "happening now" follow real time.
  // Preview any moment from Site settings, or with ?now=2027-01-30T17:30 (IST).
  const liveStart = days[0].axisStart - 8 * HOUR;
  const liveEnd = days[days.length - 1].axisEnd;
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("now");
    const fake = param
      ? Date.parse(`${param}${/[+-]\d\d:\d\d$|Z$/.test(param) ? "" : "+05:30"}`)
      : (previewAt ?? NaN);
    const mountedAt = Date.now();
    const read = () => (Number.isFinite(fake) ? fake + (Date.now() - mountedAt) : Date.now());
    const tick = () => {
      const n = read();
      setNow(n >= liveStart && n <= liveEnd ? n : null);
    };
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 20_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [liveStart, liveEnd, previewAt]);

  const mode: Mode =
    userMode === null ? (now !== null ? "live" : "auto") : userMode === "live" && now === null ? "auto" : userMode;
  const liveDay =
    mode === "live" && now !== null
      ? (days.find((d) => now >= d.axisStart && now <= d.axisEnd) ??
        days.find((d) => d.axisStart > now) ??
        days[days.length - 1])
      : null;
  const shownDayId = liveDay?.id ?? dayId;
  const day = days.find((d) => d.id === shownDayId)!;
  const shownSelectedId = liveDay && now !== null ? focusAt(liveDay.events, now).id : selectedId;

  // Live mode: the sky follows the real clock.
  useEffect(() => {
    if (mode === "live" && now !== null) void tweenTo(now);
  }, [mode, now, tweenTo]);

  // Auto-play: glide through the day, pausing on each moment.
  useEffect(() => {
    if (mode !== "auto" || !inView || (reduced && userMode === null)) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)));
    const evs = day.events;
    (async () => {
      let i = Math.max(0, evs.findIndex((e) => e.id === selectedRef.current));
      while (!cancelled) {
        setSelected(evs[i].id);
        await tweenTo(evs[i].start);
        if (cancelled) return;
        await wait(2600);
        if (cancelled) return;
        i += 1;
        if (i >= evs.length) {
          await tweenTo(day.axisEnd - HOUR / 2, 2600);
          if (cancelled) return;
          await wait(2000);
          if (cancelled) return;
          i = 0;
        }
      }
    })();
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      cancelAnimationFrame(rafRef.current);
    };
  }, [mode, inView, reduced, userMode, day, setSelected, tweenTo]);

  function changeDay(id: DayId) {
    if (id === shownDayId) return;
    const d = days.find((x) => x.id === id)!;
    const focus = firstFocus(d);
    setDayId(id);
    setSelected(focus.id);
    if (mode === "live") setUserMode("manual");
    if (mode !== "auto" || reduced) void tweenTo(focus.start);
  }

  function pick(e: TLEvent) {
    setUserMode("manual");
    setDayId(e.day);
    setSelected(e.id);
    void tweenTo(e.start);
  }

  function scrub(minutes: number) {
    setUserMode("manual");
    setDayId(day.id);
    const v = day.axisStart + minutes * 60_000;
    jump(v);
    setSelected(focusAt(day.events, v).id);
  }

  function togglePlay() {
    setDayId(day.id);
    setSelected(shownSelectedId);
    setUserMode(mode === "auto" ? "manual" : "auto");
  }

  function onTabKey(e: React.KeyboardEvent, index: number, list: TLDay[]) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = list[(index + (e.key === "ArrowRight" ? 1 : list.length - 1)) % list.length];
    changeDay(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  // ── derived values ──
  const hour = istHour(t);
  const sky = useMemo(() => skyAt(hour, sun), [hour, sun]);
  const span = day.axisEnd - day.axisStart;
  const pct = (ms: number) => ((Math.min(day.axisEnd, Math.max(day.axisStart, ms)) - day.axisStart) / span) * 100;
  const inAxis = t >= day.axisStart - HOUR && t <= day.axisEnd + HOUR;
  const selected = day.events.find((e) => e.id === shownSelectedId) ?? firstFocus(day);
  const activeNow = activeAt(day.events, t);
  const nextUp = day.events.find((e) => e.start > t);
  const live = mode === "live" && now !== null;

  const marker = isNarrow ? 36 : 42;
  const lanes = useMemo(() => {
    const laneEnds: number[] = [];
    const out = new Map<string, number>();
    for (const e of day.events) {
      const x0 = ((e.start - day.axisStart) / span) * trackW;
      const x1 = Math.max(x0 + marker, ((endOf(e) - day.axisStart) / span) * trackW);
      let lane = laneEnds.findIndex((end) => end <= x0 + 1);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(x1);
      } else laneEnds[lane] = x1;
      out.set(e.id, lane);
    }
    return { of: out, count: Math.max(1, laneEnds.length) };
  }, [day, span, trackW, marker]);

  const tickStep = trackW < 420 ? 4 : trackW < 760 ? 3 : 2;
  const ticks: number[] = [];
  const firstTick = Math.ceil((day.axisStart + IST_OFFSET_MS) / HOUR) * HOUR - IST_OFFSET_MS;
  for (let h = firstTick; h <= day.axisEnd - HOUR / 2; h += HOUR) {
    if (Math.round(istHour(h)) % tickStep === 0) ticks.push(h);
  }
  const trackH = lanes.count * (marker + 6) + 34;

  const status = (e: TLEvent) => {
    if (!live || now === null) return null;
    if (e.start <= now && now < endOf(e)) return "now";
    if (endOf(e) <= now) return "done";
    return "next";
  };

  const headline = activeNow.length
    ? activeNow.map((e) => e.title).join(" · ")
    : nextUp
      ? `Next: ${nextUp.title} at ${clock(nextUp.start)}`
      : "That's a wrap for today";

  return (
    <>
      {/* Day switcher */}
      <div role="tablist" aria-label="Wedding days" className="flex gap-2 overflow-x-auto px-4 pb-4 lg:gap-3 lg:px-28">
        {mainDays.map((d, i) => {
          const on = d.id === shownDayId;
          return (
            <button
              key={d.id}
              id={`tab-${d.id}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls="sky-timeline"
              tabIndex={on ? 0 : -1}
              onClick={() => changeDay(d.id)}
              onKeyDown={(e) => onTabKey(e, i, mainDays)}
              className={cx(
                "flex shrink-0 flex-col items-start gap-0.5 rounded-[22px] border-2 px-5 py-3 text-left transition-all duration-300 ease-[var(--ease-soft)]",
                on
                  ? "border-ink bg-ink text-white shadow-[var(--shadow-lift)]"
                  : "border-sand-300 bg-sand-50 text-ink hover:-translate-y-0.5",
              )}
            >
              <span className="flex items-baseline gap-2">
                <span className="font-serif text-[22px] leading-tight lg:text-2xl">{d.label}</span>
                <span className={cx("text-[15px] font-semibold", on ? "text-[#e4f5ef]" : "text-ink-soft")}>{d.dateLabel}</span>
              </span>
              <span className={cx("hidden text-sm sm:block", on ? "text-[#e4f5ef]" : "text-ink-soft")}>{d.summary}</span>
            </button>
          );
        })}
        {extraDay && (
          <button
            id={`tab-${extraDay.id}`}
            role="tab"
            type="button"
            aria-selected={shownDayId === extraDay.id}
            aria-controls="sky-timeline"
            tabIndex={shownDayId === extraDay.id ? 0 : -1}
            onClick={() => changeDay(extraDay.id)}
            className={cx(
              "flex shrink-0 flex-col items-start justify-center gap-0.5 self-stretch rounded-[22px] border-2 border-dashed px-4 py-2 text-left text-sm transition-colors",
              shownDayId === extraDay.id ? "border-ink bg-sand-200 text-ink" : "border-sand-300 text-ink-soft hover:text-ink",
            )}
          >
            <span className="font-semibold">{extraDay.dateLabel}</span>
            <span>Checkout morning</span>
          </button>
        )}
      </div>

      {/* The sky timeline */}
      <section
        id="sky-timeline"
        role="tabpanel"
        aria-labelledby={`tab-${shownDayId}`}
        className="px-3 lg:px-28"
      >
        <div
          ref={sceneRef}
          className="relative h-[540px] overflow-hidden rounded-[28px] bg-sky-200 shadow-[0_18px_40px_rgb(31_58_61/0.14)] sm:h-[520px] lg:h-[580px] lg:rounded-[36px]"
        >
          <SkyScene sky={sky} size={size} />

          {/* Time of day */}
          <div className="absolute top-4 left-4 flex max-w-[calc(100%-2rem)] flex-col gap-1 rounded-[20px] bg-sand-50/85 px-4 py-3 shadow-[var(--shadow-rest)] backdrop-blur-md lg:top-6 lg:left-6 lg:px-5">
            <span className="flex items-center gap-2">
              <span className={cx("flex size-7 items-center justify-center rounded-full", sky.night > 0.5 ? "bg-ink text-[#f3efe0]" : "bg-sun-300 text-ink")}>
                <Icon name={sky.night > 0.5 ? "moon" : "sun"} size={16} strokeWidth={2} />
              </span>
              <span className="text-lg font-bold tabular-nums">{clock(t)}</span>
              <span className="kicker text-lg text-sea-700">{sky.label}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-ink-soft" aria-live="polite">
                {headline}
              </span>
              {now !== null && (
                <button
                  type="button"
                  onClick={() => setUserMode("live")}
                  className={cx(
                    "flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold sm:hidden",
                    live ? "bg-coral-600 text-white" : "bg-sand-200 text-ink",
                  )}
                >
                  <span className={cx("size-2 rounded-full", live ? "animate-flicker bg-white" : "bg-coral-600")} />
                  {live ? "Live" : "Back to now"}
                </button>
              )}
            </span>
          </div>

          {/* Live badge */}
          {now !== null && (
            <button
              type="button"
              onClick={() => {
                setUserMode("live");
              }}
              className={cx(
                "absolute top-4 right-4 hidden min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold shadow-[var(--shadow-rest)] backdrop-blur-md sm:flex lg:top-6 lg:right-6",
                live ? "bg-coral-600 text-white" : "bg-sand-50/85 text-ink",
              )}
            >
              <span className={cx("size-2.5 rounded-full", live ? "animate-flicker bg-white" : "bg-coral-600")} />
              {live ? "Live now" : "Back to now"}
            </button>
          )}

          {/* Timeline bar */}
          <div className="absolute inset-x-3 bottom-3 rounded-[24px] bg-sand-50/88 px-3 pt-3 pb-2 shadow-[0_10px_30px_rgb(31_58_61/0.16)] backdrop-blur-md lg:inset-x-6 lg:bottom-6 lg:px-5 lg:pt-4">
            <div className="flex items-end gap-3 lg:gap-4">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={mode === "auto" ? "Pause the day" : "Play the day"}
                className="mb-6 flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform duration-200 ease-[var(--ease-spring)] hover:scale-105 active:scale-95"
              >
                <Icon name={mode === "auto" && !reduced ? "pause" : "play"} size={18} strokeWidth={2.2} />
              </button>

              <div ref={trackRef} className="relative flex-1" style={{ height: trackH }}>
                {day.events.map((e) => {
                  const lane = lanes.of.get(e.id) ?? 0;
                  const left = pct(e.start);
                  const width = pct(endOf(e)) - left;
                  const on = e.id === selected.id;
                  const st = status(e);
                  const wide = (width / 100) * trackW - marker - 12 >= e.title.length * 6.6;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => pick(e)}
                      aria-pressed={on}
                      aria-label={`${e.title}, ${e.timeLabel}`}
                      title={`${e.title} · ${e.timeLabel}`}
                      className={cx(
                        "absolute z-10 flex items-center gap-2 overflow-hidden rounded-full pr-3 text-left whitespace-nowrap transition-all duration-300 ease-[var(--ease-soft)]",
                        capsuleFill[e.tint],
                        on ? "shadow-[0_0_0_2px_var(--color-ink)]" : "hover:-translate-y-0.5",
                        st === "done" && "opacity-55",
                      )}
                      style={{
                        left: `${left}%`,
                        width: `calc(max(${marker}px, ${width}%) - 3px)`,
                        bottom: 34 + lane * (marker + 6),
                        height: marker,
                      }}
                    >
                      <span
                        className={cx(
                          "flex shrink-0 items-center justify-center rounded-full",
                          on ? "bg-ink text-white" : "bg-sand-50 text-ink",
                          st === "now" && "ring-2 ring-coral-600 ring-offset-1",
                        )}
                        style={{ width: marker, height: marker }}
                      >
                        <Icon name={e.icon} size={isNarrow ? 18 : 20} strokeWidth={1.9} />
                      </span>
                      {wide && <span className="truncate text-[13px] font-bold">{e.title}</span>}
                    </button>
                  );
                })}

                {/* axis */}
                <div className="absolute inset-x-0 bottom-[26px] h-[3px] rounded-full bg-ink/15" />
                {ticks.map((h) => (
                  <span
                    key={h}
                    className="absolute bottom-0 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap text-ink-soft lg:text-xs"
                    style={{ left: `${pct(h)}%` }}
                  >
                    {clock(h)}
                  </span>
                ))}

                {/* scrubber (keyboard + drag) */}
                <input
                  type="range"
                  min={0}
                  max={Math.round(span / 60_000)}
                  step={15}
                  value={Math.round((Math.min(day.axisEnd, Math.max(day.axisStart, t)) - day.axisStart) / 60_000)}
                  onChange={(ev) => scrub(Number(ev.target.value))}
                  aria-label={`Time on ${day.label}, ${day.dateLabel}`}
                  aria-valuetext={`${clock(t)}, ${headline}`}
                  className="peer absolute inset-x-0 bottom-0 z-0 h-[30px] w-full cursor-ew-resize opacity-0"
                />
                {inAxis && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-[20px] z-20 -translate-x-1/2 peer-focus-visible:[&>span:last-child]:ring-4 peer-focus-visible:[&>span:last-child]:ring-sky-700"
                    style={{ left: `${pct(t)}%`, height: trackH - 20 }}
                  >
                    <span className="absolute bottom-3 left-1/2 w-[2px] -translate-x-1/2 bg-ink/45" style={{ height: trackH - 26 }} />
                    <span
                      className={cx(
                        "absolute bottom-0 left-1/2 flex size-[15px] -translate-x-1/2 items-center justify-center rounded-full border-2 border-sand-50 shadow",
                        sky.night > 0.5 ? "bg-[#dfe7f5]" : "",
                      )}
                      style={sky.night > 0.5 ? undefined : { background: sky.sunColor }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Details + the day's agenda */}
      <section className="grid gap-6 px-4 pt-8 pb-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 lg:px-28 lg:pt-10 lg:pb-20">
        <div
          key={selected.id}
          className="animate-fade-up flex flex-col gap-3.5 self-start rounded-[32px] bg-sand-50 p-6 shadow-[0_10px_30px_rgb(31_58_61/0.08)] lg:p-8"
        >
          <div className="flex items-center gap-4">
            <span className={cx("flex size-16 shrink-0 items-center justify-center rounded-full", tintBg[selected.tint])}>
              <Icon name={selected.icon} size={30} strokeWidth={1.5} />
            </span>
            <div className="flex flex-col gap-1">
              <p className="kicker text-2xl text-sea-700">
                {day.label} · {timeOfDayLabel(istHour(selected.start)).toLowerCase()}
              </p>
              {status(selected) === "now" && (
                <span className="self-start rounded-full bg-coral-600 px-2.5 py-0.5 text-xs font-bold text-white">Happening now</span>
              )}
              {status(selected) === "next" && (
                <span className="self-start rounded-full bg-sea-200 px-2.5 py-0.5 text-xs font-bold text-sea-800">Up next</span>
              )}
            </div>
          </div>
          <h2 className="font-serif text-[34px] leading-[1.1] lg:text-[40px]">{selected.title}</h2>
          <p className="flex items-center gap-2.5 text-lg font-semibold">
            <Icon name="clock" />
            {selected.timeLabel}
            <span className="font-normal text-ink-soft">· {day.dateLabel}</span>
          </p>
          <p className="flex items-center gap-2.5 text-lg font-semibold">
            <Icon name="pin" />
            {selected.venue}
          </p>
          <p className="max-w-[560px] text-[17px] leading-relaxed text-ink-soft">{selected.blurb}</p>
          <div className="mt-1 flex flex-wrap gap-3">
            {selected.mapsUrl && (
              <a href={selected.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-sea">
                <Icon name="pin" size={20} strokeWidth={2} />
                Get directions
              </a>
            )}
            {selected.calendar?.ready && selected.calendar.google && (
              <a href={selected.calendar.google} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-sea">
                <Icon name="calendar" size={20} strokeWidth={2} />
                Google Calendar
              </a>
            )}
            {selected.calendar?.ready && (
              <a href={selected.calendar.ics} download className="btn btn-sm btn-outline-sea">
                <Icon name="download" size={20} strokeWidth={2} />
                Apple / Outlook (.ics)
              </a>
            )}
            {selected.meal && (
              <Link href="/rsvp?step=meal" className="btn btn-sm btn-outline-sea">
                <Icon name="plate" size={20} strokeWidth={2} />
                Pick my meal
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[32px] bg-sand-50 p-5 shadow-[var(--shadow-rest)] lg:p-6">
          <h3 className="flex items-baseline gap-2 px-1 font-serif text-2xl">
            {day.label}
            <span className="font-sans text-base font-semibold text-ink-soft">{day.dateLabel}</span>
          </h3>
          <ol className="flex flex-col gap-1">
            {day.events.map((e) => {
              const on = e.id === selected.id;
              const st = status(e);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => pick(e)}
                    aria-current={on ? "true" : undefined}
                    className={cx(
                      "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors",
                      on ? "bg-sea-200" : "hover:bg-sand-200/70",
                      st === "done" && "opacity-60",
                    )}
                  >
                    <span className="w-[92px] shrink-0 text-sm font-semibold text-ink-soft tabular-nums">{e.timeLabel}</span>
                    <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", tintBg[e.tint])}>
                      <Icon name={e.icon} size={18} strokeWidth={1.9} />
                    </span>
                    <span className="flex-1 font-semibold">{e.title}</span>
                    {st === "now" && <span className="rounded-full bg-coral-600 px-2 py-0.5 text-xs font-bold text-white">Now</span>}
                    {st === "done" && <Icon name="check" size={18} strokeWidth={2.2} className="text-sea-700" />}
                  </button>
                </li>
              );
            })}
          </ol>
          {extraDay && shownDayId === "day2" && (
            <button
              type="button"
              onClick={() => changeDay(extraDay.id)}
              className="mt-1 flex min-h-12 items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-sand-300 px-4 py-2 text-left text-sm text-ink-soft hover:text-ink"
            >
              <span>
                <span className="font-semibold text-ink">The morning after · {extraDay.dateLabel}</span>
                <br />
                {extraDay.events.map((e) => `${e.title} ${e.timeLabel.toLowerCase()}`).join(" · ")}
              </span>
              <Icon name="arrow-right" size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      </section>
    </>
  );
}
