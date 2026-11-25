import { cx } from "@/lib/ui";

/** Simple horizontal bars for the dashboard. */
export function Bars({ rows, unit }: { rows: { label: string; count: number; muted?: boolean; detail?: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[130px_minmax(0,1fr)_44px] items-center gap-3 sm:grid-cols-[150px_minmax(0,1fr)_48px]"
          title={`${r.label}: ${r.count} ${unit}${r.detail ? ` (${r.detail})` : ""}`}
        >
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">{r.label}</span>
            {r.detail && <span className="text-xs text-ink-soft">{r.detail}</span>}
          </span>
          <span className="h-4 rounded-r-[4px] bg-sand-200">
            <span
              className={cx("block h-full rounded-r-[4px]", r.muted ? "bg-ink-muted/40" : "bg-sea-700")}
              style={{ width: `${(r.count / max) * 100}%`, minWidth: r.count ? 4 : 0 }}
            />
          </span>
          <span className="text-right text-[15px] font-semibold tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
