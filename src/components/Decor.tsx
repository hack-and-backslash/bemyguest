/* eslint-disable @next/next/no-img-element -- small decorative SVGs, no optimisation needed */
import { cx } from "@/lib/ui";

export function Illustration({ name, className, alt = "" }: { name: string; className?: string; alt?: string }) {
  return <img src={`/illustrations/${name}.svg`} alt={alt} className={className} loading="lazy" decoding="async" />;
}

export function Wave({ fill, className }: { fill: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 72"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cx("block h-10 w-full lg:h-[72px]", className)}
    >
      <path d="M0 40 C180 8 360 8 540 34 S900 66 1080 36 S1340 10 1440 30 L1440 72 L0 72 Z" fill={fill} />
    </svg>
  );
}

export function FairyLights({ className }: { className?: string }) {
  const bulbs = [
    [70, 30, "#F7D774", 0], [160, 44, "#F4A259", 0.4], [250, 42, "#F7D774", 0.9], [340, 26, "#8FD3C1", 0.2],
    [440, 16, "#F7D774", 1.3], [540, 30, "#F28C74", 0.6], [630, 30, "#F7D774", 1.1], [720, 22, "#8CCBE6", 0.3],
    [810, 15, "#F7D774", 1.6], [900, 30, "#F4A259", 0.8], [990, 30, "#F7D774", 0.1], [1080, 22, "#8FD3C1", 1.4],
    [1170, 15, "#F7D774", 0.5], [1260, 28, "#F28C74", 1], [1360, 24, "#F7D774", 0.7],
  ] as const;
  return (
    <svg viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" className={cx("block w-full", className)}>
      <path d="M0 10 Q180 70 360 22 T720 22 T1080 22 T1440 14" fill="none" stroke="#1F3A3D" strokeWidth="1.5" opacity="0.45" />
      {bulbs.map(([cx_, cy, fill, delay]) => (
        <circle key={cx_} cx={cx_} cy={cy} r="7" fill={fill} className="animate-flicker" style={{ animationDelay: `${delay}s` }} />
      ))}
    </svg>
  );
}
