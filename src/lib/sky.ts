/**
 * Time-of-day maths for the sky timeline. Pure functions, no React.
 * Hours are fractional IST hours (16.5 = 4:30 PM).
 */

export const IST_OFFSET_MS = 5.5 * 3_600_000;
export const HOUR = 3_600_000;

export function istHour(ms: number) {
  const h = ((ms + IST_OFFSET_MS) / HOUR) % 24;
  return h < 0 ? h + 24 : h;
}

type RGB = [number, number, number];

function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: RGB) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}
export function mix(a: string, b: string, t: number) {
  const x = hex(a);
  const y = hex(b);
  const k = Math.min(1, Math.max(0, t));
  return toHex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Sky colour keyframes: [hour, zenith, horizon]. Tuned to the illustration's palette. */
const SKY: [number, string, string][] = [
  [0, "#0d1b2e", "#1c3252"],
  [5.3, "#15264a", "#33476f"],
  [6.3, "#4d5f93", "#e9a998"],
  [7.1, "#8fbfe0", "#fbd7bd"],
  [8.4, "#b6ddf0", "#eaf5f1"],
  [12, "#9fd3ec", "#e3f3f3"],
  [15.6, "#a9d5ea", "#f3ecd8"],
  [17.3, "#9cc3dc", "#fbd8a8"],
  [18.15, "#8a97c4", "#f6a86f"],
  [18.6, "#5b6699", "#ef8a6b"],
  [19.2, "#2e3f6c", "#a8708a"],
  [20.2, "#172a4b", "#34486c"],
  [24, "#0d1b2e", "#1c3252"],
];

export type Sky = {
  zenith: string;
  horizon: string;
  /** 0 day → 1 deep night */
  night: number;
  /** golden-hour / dawn warmth 0–1 */
  warm: number;
  /** 0–1 through daylight, or null when the sun is down */
  sunT: number | null;
  /** 0–1 through the night, or null by day */
  moonT: number | null;
  sunColor: string;
  cloud: string;
  label: string;
};

export function timeOfDayLabel(h: number) {
  if (h < 5) return "After midnight";
  if (h < 7) return "Before sunrise";
  if (h < 10.5) return "Good morning";
  if (h < 12) return "Late morning";
  if (h < 15) return "Afternoon";
  if (h < 17) return "Late afternoon";
  if (h < 18.45) return "Golden hour";
  if (h < 19.1) return "Sunset";
  if (h < 21) return "Evening";
  return "Under the stars";
}

export function skyAt(h: number, sun: { rise: number; set: number }): Sky {
  let i = 0;
  while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++;
  const [h0, z0, b0] = SKY[i];
  const [h1, z1, b1] = SKY[i + 1];
  const t = (h - h0) / (h1 - h0 || 1);

  const night = h >= 12 ? smooth(18.4, 20, h) : 1 - smooth(5.3, 7.1, h);
  const warm = Math.max(
    h < 12 ? smooth(6.2, 7.1, h) * (1 - smooth(7.1, 8.4, h)) * 0.7 : 0,
    h >= 12 ? smooth(15.8, 18.2, h) * (1 - smooth(18.3, 19.3, h)) : 0,
  );

  const sunRaw = (h - sun.rise) / (sun.set - sun.rise);
  const sunT = sunRaw > -0.02 && sunRaw < 1.04 ? sunRaw : null;
  const nightStart = sun.set + 0.25;
  const nightLen = 24 - nightStart + sun.rise - 0.3;
  const intoNight = (h - nightStart + 24) % 24;
  const moonT = intoNight <= nightLen ? intoNight / nightLen : null;

  return {
    zenith: mix(z0, z1, t),
    horizon: mix(b0, b1, t),
    night,
    warm,
    sunT,
    moonT,
    sunColor: mix("#f7d774", "#f28c74", warm),
    cloud: mix(mix("#ffffff", "#fbd3c3", warm), "#50618a", night),
    label: timeOfDayLabel(h),
  };
}

/**
 * The sun's path across the visible sky, as fractions: x of the visible width,
 * y from the top of the visible area (0) to the horizon (1). The lawn at
 * Stone Water looks west over the Arabian Sea, so the sun arcs in from high on
 * the left and sets into the sea just left of centre (the artwork keeps that
 * patch of sky clear of trees).
 */
export function sunPath(t: number) {
  const p0 = [-0.08, -0.28];
  const p1 = [0.1, 0.02];
  const p2 = [0.44, 1.02];
  const u = 1 - t;
  return {
    x: u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    y: u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  };
}

/** The moon keeps to the open sky over the sea, clear of the big tree on the right. */
export function moonPath(t: number) {
  return { x: 0.54 - 0.2 * t, y: 0.62 - 0.5 * Math.sin(Math.PI * t) };
}
