/* eslint-disable @next/next/no-img-element -- Google profile photos come from many hosts */
import { cx } from "@/lib/ui";

const palette = [
  { bg: "bg-sea-200", ring: "#8FD3C1" },
  { bg: "bg-coral-200", ring: "#F28C74" },
  { bg: "bg-sky-200", ring: "#8CCBE6" },
  { bg: "bg-sun-100", ring: "#F7D774" },
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function Avatar({
  name,
  url,
  size = 44,
  ringed = false,
  tone,
  className,
}: {
  name: string;
  url?: string | null;
  size?: number;
  ringed?: boolean;
  tone?: "sun";
  className?: string;
}) {
  const p = palette[hash(name || "?") % palette.length];
  const bg = tone === "sun" ? "bg-sun-300" : p.bg;
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.38),
    boxShadow: ringed ? `0 0 0 3px var(--color-sand-100), 0 0 0 5px ${p.ring}` : undefined,
  };
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className={cx("shrink-0 rounded-full object-cover", className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cx("flex shrink-0 items-center justify-center rounded-full font-bold text-ink", bg, className)}
      style={style}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
