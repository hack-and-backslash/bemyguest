"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { cx } from "@/lib/ui";

// Ticks live in this browser only (it's a personal list), so no server round trip.
const KEY = "bemyguest:packing";
const EVENT = "bemyguest:packing";

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function write(ticked: Set<number>) {
  try {
    window.localStorage.setItem(KEY, [...ticked].join(","));
  } catch {
    // Private mode or storage blocked: the list still works for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function PackingList({ items }: { items: string[] }) {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const ticked = new Set(
    raw
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((i) => i >= 0 && i < items.length),
  );
  const count = ticked.size;
  const done = count === items.length;

  function toggle(i: number) {
    const next = new Set(ticked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    write(next);
  }

  return (
    <section
      aria-labelledby="packing-title"
      className="relative flex flex-col gap-4 rounded-[32px] bg-sea-200 p-7 lg:p-9"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="packing-title" className="font-serif text-[28px] leading-tight lg:text-[30px]">
          Packing list
        </h2>
        <p className="font-script text-xl text-sea-800" aria-live="polite">
          {done ? "All packed. See you there!" : `${count} of ${items.length} packed`}
        </p>
      </div>
      <span className="h-2 overflow-hidden rounded-full bg-sand-50/80" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-sea-700 transition-[width] duration-500"
          style={{ width: `${(count / items.length) * 100}%` }}
        />
      </span>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => {
          const on = ticked.has(i);
          return (
            <li key={item}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(i)}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-[16px] leading-snug transition-colors hover:bg-sand-50/70"
              >
                <span
                  className={cx(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors",
                    on ? "border-sea-700 bg-sea-700 text-white" : "border-sea-700/50 bg-sand-50",
                  )}
                >
                  {on && <Icon name="check" size={18} strokeWidth={2.5} />}
                </span>
                <span className={cx(on && "text-ink-soft line-through decoration-sea-700/60")}>{item}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-soft">Your ticks are saved on this device only.</p>
    </section>
  );
}
