/**
 * Hand-drawn map of the Mormugao peninsula: not to scale, just enough to show
 * where the resort sits relative to the airport, Vasco and Madgaon.
 */
export function TravelMap({ className }: { className?: string }) {
  const land = "#F3E1C0";
  const green = "#E4EFD2";
  const ink = "#1F3A3D";
  return (
    <svg
      viewBox="0 0 640 440"
      role="img"
      aria-labelledby="travel-map-title travel-map-desc"
      className={className}
    >
      <title id="travel-map-title">Map of the area around the resort</title>
      <desc id="travel-map-desc">
        Stone Water Eco Resort sits on the south-west coast of the Mormugao peninsula at Santarem Beach, near Bogmalo,
        about 5 km from Dabolim airport. Vasco da Gama is to the north, Madgaon about 25 km to the south-east, and
        Panaji and Mopa airport are further north across the Zuari river.
      </desc>
      <rect width="640" height="440" fill="#A6E2D5" />
      {/* waves */}
      <g fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
        <path d="M40 90 q8 -8 16 0 q8 -8 16 0" />
        <path d="M70 300 q8 -8 16 0 q8 -8 16 0" />
        <path d="M120 390 q8 -8 16 0 q8 -8 16 0" />
        <path d="M30 210 q8 -8 16 0 q8 -8 16 0" />
      </g>
      {/* north bank of the Zuari (Panaji side) */}
      <path d="M232 0 C270 28 340 46 420 46 C500 46 580 54 640 64 L640 0 Z" fill={land} />
      <path d="M262 0 C300 22 360 34 430 34 C510 34 580 42 640 50 L640 0 Z" fill={green} />
      {/* the peninsula and the coast running south */}
      <path
        d="M640 124 C560 116 470 124 390 116 C312 110 240 118 180 138 C128 156 100 182 112 204 C124 224 160 226 184 238 C204 248 210 270 216 296 C224 334 238 390 246 440 L640 440 Z"
        fill={land}
      />
      <path
        d="M640 142 C560 134 480 142 400 134 C322 128 256 136 200 154 C156 170 136 188 146 204 C158 220 186 226 204 238 C224 252 232 276 238 302 C246 340 260 392 268 440 L640 440 Z"
        fill={green}
      />
      {/* coast foam */}
      <path
        d="M112 204 C124 224 160 226 184 238 C204 248 210 270 216 296 C224 334 238 390 246 440"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeDasharray="12 9"
        opacity="0.9"
      />
      {/* trees */}
      <g fill="#8FC49A" opacity="0.85">
        {[
          [590, 200, 9], [612, 250, 10], [450, 250, 9], [520, 285, 11], [575, 316, 9], [612, 352, 10],
          [330, 300, 9], [300, 360, 10], [380, 392, 8], [624, 392, 8], [262, 262, 8],
        ].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>

      {/* roads */}
      <g fill="none" strokeLinecap="round">
        <path d="M300 196 C330 230 370 280 420 330 C450 360 470 380 500 400" stroke="#FFFBF3" strokeWidth="9" />
        <path d="M300 196 C330 230 370 280 420 330 C450 360 470 380 500 400" stroke="#E7D2AE" strokeWidth="2" strokeDasharray="7 7" />
        <path d="M300 150 C300 170 300 180 300 196" stroke="#FFFBF3" strokeWidth="8" />
        <path d="M300 150 C318 110 360 70 420 40" stroke="#FFFBF3" strokeWidth="8" opacity="0.9" />
      </g>
      {/* the drive from the airport: highlighted */}
      <path d="M296 204 C270 214 236 222 200 230" fill="none" stroke="#B5472F" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 9" />

      {/* airport runway */}
      <g transform="rotate(-14 330 190)">
        <rect x="268" y="184" width="130" height="13" rx="3" fill="#D8CDB6" />
        <path d="M276 190.5 H390" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="8 7" />
      </g>
      <g transform="translate(372 168)" fill="none" stroke={ink} strokeWidth="1.8" strokeLinejoin="round">
        <circle r="15" fill="#FFFBF3" />
        <path d="M-9 1.5 7 -4a1.4 1.4 0 0 1 .9 2.6L-5.5 3.8-8.5 2.8ZM-3.5 -.3-5.8 -6l1.8-.5 4.6 4.3M-2 2.9l1 4.3 1.6-.6.5-4.8" transform="scale(1.05)" />
      </g>

      {/* towns */}
      <g fill={ink}>
        <circle cx="300" cy="148" r="5" />
        <circle cx="500" cy="400" r="5" />
      </g>

      {/* the resort */}
      <g transform="translate(186 232)">
        <ellipse cx="0" cy="3" rx="12" ry="4" fill={ink} opacity="0.2" />
        <path d="M0 2 C-16 -16 -20 -24 -20 -34 A20 20 0 0 1 20 -34 C20 -24 16 -16 0 2 Z" fill="#B5472F" />
        <circle cx="0" cy="-34" r="7.5" fill="#FFFBF3" />
      </g>

      {/* labels */}
      <g fill={ink}>
        <text x="170" y="262" className="font-script" fontSize="25" fontWeight="700" textAnchor="end">
          Stone Water
        </text>
        <text x="170" y="281" fontSize="13" textAnchor="end" opacity="0.8">
          Santarem Beach
        </text>
        <text x="228" y="290" fontSize="14" fontWeight="600">
          Bogmalo
        </text>
        <text x="312" y="140" fontSize="15" fontWeight="700">
          Vasco da Gama
        </text>
        <text x="394" y="165" fontSize="15" fontWeight="700">
          Dabolim airport
        </text>
        <text x="394" y="183" fontSize="13" opacity="0.8">
          GOI · 5 km, 10–15 min
        </text>
        <text x="512" y="396" fontSize="15" fontWeight="700">
          Madgaon
        </text>
        <text x="512" y="413" fontSize="13" opacity="0.8">
          25 km · trains
        </text>
        <text x="470" y="26" fontSize="13" fontWeight="700">
          ↑ Panaji 30 km · Mopa 90 km
        </text>
        <text x="520" y="92" fontSize="13" fontStyle="italic" opacity="0.7">
          Zuari river
        </text>
        <text x="40" y="360" fontSize="15" fontStyle="italic" opacity="0.7">
          Arabian Sea
        </text>
        <text x="20" y="424" fontSize="11" opacity="0.6">
          Not to scale
        </text>
      </g>

      {/* compass */}
      <g transform="translate(56 50)">
        <circle r="22" fill="#FFFBF3" opacity="0.9" />
        <path d="M0 -16 L5.5 0 L0 16 L-5.5 0 Z" fill="#B5472F" />
        <path d="M0 -16 L5.5 0 L-5.5 0 Z" fill={ink} />
        <text y="-26" fontSize="12" fontWeight="700" textAnchor="middle" fill={ink}>
          N
        </text>
      </g>
    </svg>
  );
}
