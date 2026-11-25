"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function parts(ms: number): [number, string][] {
  const left = Math.max(0, ms);
  const d = Math.floor(left / DAY);
  const h = Math.floor((left % DAY) / HOUR);
  const m = Math.floor((left % HOUR) / MIN);
  if (d > 0) return [[d, d === 1 ? "day" : "days"], [h, h === 1 ? "hr" : "hrs"]];
  return [[h, h === 1 ? "hr" : "hrs"], [m, "min"]];
}

/**
 * "Opens in 121 days 13 hrs", ticking; reloads into the live booth at opening
 * time. Ticks on from `now`, which is a preview moment when the couple preview a date.
 */
export function Countdown({ target, now }: { target: number; now: number }) {
  const [t, setT] = useState(now);
  const router = useRouter();

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const current = now + (Date.now() - start);
      setT(current);
      if (current >= target) {
        clearInterval(id);
        router.refresh();
      }
    }, 20_000);
    return () => clearInterval(id);
  }, [target, router, now]);

  const shown = parts(target - t);
  return (
    <div
      role="timer"
      aria-label={`${shown.map(([n, u]) => `${n} ${u}`).join(", ")} until the booth opens`}
      className="flex items-center justify-between gap-3 rounded-[22px] bg-sun-100 px-4 py-3"
    >
      <span className="text-sm font-bold">Opens in</span>
      <span className="flex items-baseline gap-3">
        {shown.map(([n, u]) => (
          <span key={u} className="flex items-baseline gap-1">
            <span className="font-serif text-[28px] leading-none">{n}</span>
            <span className="text-[13px] font-semibold">{u}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
