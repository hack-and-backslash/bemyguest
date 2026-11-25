/* eslint-disable @next/next/no-img-element -- layered SVG illustration */
import { FairyLights } from "@/components/Decor";
import { moonPath, sunPath, type Sky } from "@/lib/sky";

const W = 1600;
const H = 900;
const HORIZON = 470;
const LAND = "/illustrations/scene-land.svg";

// Deterministic star field (upper sky).
const STARS = Array.from({ length: 54 }, (_, i) => {
  const a = Math.sin(i * 127.1) * 43758.5453;
  const b = Math.sin(i * 311.7) * 12731.743;
  return {
    x: Math.round((a - Math.floor(a)) * W),
    y: Math.round(20 + (b - Math.floor(b)) * 380),
    r: i % 7 === 0 ? 2.6 : i % 3 === 0 ? 1.8 : 1.2,
    delay: (i % 9) * 0.37,
  };
});

const landMask: React.CSSProperties = {
  WebkitMaskImage: `url(${LAND})`,
  maskImage: `url(${LAND})`,
  WebkitMaskSize: "cover",
  maskSize: "cover",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
};

/** Visible part of the 1600×900 artwork for a box of this size (object-fit: cover). */
export function visibleBox(w: number, h: number) {
  const s = Math.max(w / W, h / H) || 1;
  const vw = w / s;
  const vh = h / s;
  return { x0: (W - vw) / 2, y0: (H - vh) / 2, vw, vh };
}

export function SkyScene({ sky, size }: { sky: Sky; size: { w: number; h: number } }) {
  const box = visibleBox(size.w, size.h);
  const toX = (fx: number) => box.x0 + fx * box.vw;
  const toY = (fy: number) => box.y0 + fy * (HORIZON - box.y0);

  const sunPos = sky.sunT !== null ? sunPath(sky.sunT) : null;
  const sunR = 58 + 26 * sky.warm;
  const moonPos = sky.moonT !== null ? moonPath(sky.moonT) : null;
  const sunX = sunPos ? toX(sunPos.x) : toX(0.44);
  const glint = sunPos ? Math.max(0, Math.min(1, (sunPos.y - 0.5) / 0.45)) * (1 - sky.night) : 0;
  const moonX = moonPos ? toX(moonPos.x) : 0;

  return (
    <div aria-hidden="true" className="absolute inset-0">
      {/* Sky, sun, moon, stars, clouds */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="tl-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky.zenith} />
            <stop offset="1" stopColor={sky.horizon} />
          </linearGradient>
          <radialGradient id="tl-sun-halo">
            <stop offset="0" stopColor={sky.sunColor} stopOpacity="0.6" />
            <stop offset="0.45" stopColor={sky.sunColor} stopOpacity="0.18" />
            <stop offset="1" stopColor={sky.sunColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tl-horizon-glow">
            <stop offset="0" stopColor="#f6a86f" stopOpacity="0.75" />
            <stop offset="1" stopColor="#f6a86f" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tl-moon-halo">
            <stop offset="0" stopColor="#eef2fb" stopOpacity="0.45" />
            <stop offset="1" stopColor="#eef2fb" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y={box.y0 - 2} width={W} height={HORIZON - box.y0 + 60} fill="url(#tl-sky)" />

        <g opacity={sky.night}>
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#fdf6e3"
              className="animate-flicker"
              style={{ animationDelay: `${s.delay}s` }}
            />
          ))}
        </g>

        <ellipse cx={sunX} cy={HORIZON} rx="560" ry="150" fill="url(#tl-horizon-glow)" opacity={sky.warm} />

        {moonPos && (
          <g opacity={sky.night} transform={`translate(${moonX} ${toY(moonPos.y)})`}>
            <circle r="120" fill="url(#tl-moon-halo)" />
            <circle r="34" fill="#f3efe0" />
            <circle cx="-9" cy="-8" r="6" fill="#e2dccb" />
            <circle cx="10" cy="7" r="8" fill="#e2dccb" />
            <circle cx="-4" cy="14" r="3.5" fill="#e2dccb" />
          </g>
        )}

        {sunPos && (
          <g transform={`translate(${sunX} ${toY(sunPos.y)})`}>
            <circle r={sunR * 2.8} fill="url(#tl-sun-halo)" />
            <circle r={sunR} fill={sky.sunColor} />
          </g>
        )}

        <g opacity={0.95 - 0.55 * sky.night}>
          <g className="animate-drift">
            <g transform={`translate(${toX(0.16)} ${toY(0.16)})`} fill={sky.cloud}>
              <ellipse cx="0" cy="26" rx="130" ry="24" />
              <circle cx="-44" cy="10" r="34" />
              <circle cx="12" cy="-4" r="44" />
              <circle cx="62" cy="14" r="28" />
            </g>
          </g>
          <g className="animate-drift [animation-direction:alternate-reverse] [animation-duration:28s]">
            <g transform={`translate(${toX(0.72)} ${toY(0.3)}) scale(0.75)`} fill={sky.cloud}>
              <ellipse cx="0" cy="26" rx="130" ry="24" />
              <circle cx="-44" cy="10" r="34" />
              <circle cx="12" cy="-4" r="44" />
              <circle cx="62" cy="14" r="28" />
            </g>
          </g>
        </g>

        <g
          fill="none"
          stroke="#1f3a3d"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity={0.55 * (1 - sky.night) * (1 - sky.warm * 0.4)}
          transform={`translate(${toX(0.58)} ${toY(0.28)})`}
        >
          <path d="M-14 0 q7 -9 14 0 q7 -9 14 0" />
          <path d="M34 22 q6 -8 12 0 q6 -8 12 0" />
        </g>
      </svg>

      {/* The clifftop lawn, cottages and sea, re-lit for the time of day */}
      <img src={LAND} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="absolute inset-0"
        style={{ ...landMask, background: "#1b2d4f", mixBlendMode: "multiply", opacity: 0.66 * sky.night }}
      />
      <div
        className="absolute inset-0"
        style={{ ...landMask, background: "#f28c74", mixBlendMode: "soft-light", opacity: 0.7 * sky.warm }}
      />

      {/* Light on the water, the cottage lamp, fairy lights in the trees */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="tl-lamp">
            <stop offset="0" stopColor="#ffd98a" stopOpacity="0.85" />
            <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g stroke={sky.warm > 0.3 ? "#ffe1b0" : "#fff6d6"} strokeWidth="3.5" strokeLinecap="round" opacity={0.85 * glint}>
          {[
            [486, 90],
            [500, 56],
            [514, 74],
            [530, 110],
            [546, 66],
            [562, 88],
            [580, 50],
          ].map(([y, w], i) => (
            <path key={i} d={`M${sunX - w / 2 + (i % 2 ? 14 : -10)} ${y} h${w}`} />
          ))}
        </g>
        {moonPos && (
          <g stroke="#dfe7f5" strokeWidth="3" strokeLinecap="round" opacity={0.6 * sky.night}>
            {[
              [490, 50],
              [506, 34],
              [522, 60],
              [540, 30],
              [558, 44],
            ].map(([y, w], i) => (
              <path key={i} d={`M${moonX - w / 2 + (i % 2 ? 8 : -6)} ${y} h${w}`} />
            ))}
          </g>
        )}
        <circle cx="953" cy="581" r="110" fill="url(#tl-lamp)" opacity={sky.night} />
      </svg>
      <div className="absolute inset-x-0 top-0" style={{ opacity: sky.night }}>
        <FairyLights className="h-12 lg:h-[72px]" />
      </div>
    </div>
  );
}
