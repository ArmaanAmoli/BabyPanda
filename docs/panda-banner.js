const RESET = "\x1b[0m";
const fg = ([r, g, b]) => `\x1b[38;2;${r};${g};${b}m`;
const bg = ([r, g, b]) => `\x1b[48;2;${r};${g};${b}m`;

// ---------- shape helpers (design space is 36 x 32) ----------
const ell = (cx, cy, rx, ry, deg = 0) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
  };
};
const arc = (cx, cy, r, t) => (x, y) =>
  Math.abs(Math.hypot(x - cx, y - cy) - r) <= t / 2 && y >= cy;

const INK = [22, 22, 27];
const mix = (a, b, k) => a.map((v, i) => Math.round(v * (1 - k) + b[i] * k));

// iris: warm brown, lighter toward the bottom for a glossy look
const iris = (cx, cy) => (x, y) => {
  const k = Math.min(1, Math.max(0, (y - (cy - 2)) / 4));
  return mix([70, 48, 42], [120, 84, 66], k);
};

const eye = (cx, cy, dir) => [
  { t: ell(cx, cy, 2.1, 2.3), c: iris(cx, cy) },                       // iris
  { t: ell(cx, cy, 1.15, 1.3), c: [8, 8, 10] },                        // pupil
  { t: ell(cx - 0.7 * dir, cy - 0.8, 0.7, 0.7), c: [255, 255, 255] },  // main highlight
  { t: ell(cx + 0.8 * dir, cy + 0.9, 0.35, 0.35), c: [235, 235, 245] },// small highlight
];

const ear = (cx) => [
  { t: ell(cx, 7.3, 5.4, 5.4), c: [58, 58, 68] },                      // rim light
  { t: ell(cx, 7.7, 5.0, 5.0), c: INK },                               // ear body
  { t: ell(cx, 8.4, 2.9, 2.9), c: [74, 64, 74] },                      // inner ear
  { t: ell(cx, 8.9, 1.7, 1.7), c: [48, 42, 50] },                      // inner ear core
];

// ---------- panda (drawn back to front) ----------
const layers = [
  ...ear(8), ...ear(28),
  // head with soft vertical shading
  {
    t: ell(18, 18, 14.5, 12.5),
    c: (x, y) => {
      const k = Math.max(0, (y - 5.5) / 25);
      return [252 - 26 * k, 252 - 26 * k, 255 - 22 * k];
    },
  },
  // muzzle
  { t: ell(18, 23.2, 5.6, 3.8), c: [255, 255, 255], a: 0.55 },
  // blush
  { t: ell(7.8, 23, 2.6, 1.8), c: [255, 165, 185], a: 0.45 },
  { t: ell(28.2, 23, 2.6, 1.8), c: [255, 165, 185], a: 0.45 },
  // eye patches (tilted)
  { t: ell(11.5, 18, 3.6, 5.6, 25), c: INK },
  { t: ell(24.5, 18, 3.6, 5.6, -25), c: INK },
  // eyes
  ...eye(12.2, 17.8, 1),
  ...eye(23.8, 17.8, -1),
  // nose + highlight
  { t: ell(18, 22.2, 2.7, 1.8), c: INK },
  { t: ell(17.0, 21.6, 1.0, 0.5), c: [110, 110, 122] },
  // mouth
  { t: (x, y) => Math.abs(x - 18) <= 0.3 && y >= 23.8 && y <= 25.2, c: [40, 40, 46] },
  { t: arc(16.6, 24.6, 1.5, 0.55), c: [40, 40, 46] },
  { t: arc(19.4, 24.6, 1.5, 0.55), c: [40, 40, 46] },
];

// ---------- rasterize ----------
const K = 1.5;                       // resolution scale (try 1.2 - 2)
const SS = 4;                        // supersampling
const W = Math.round(36 * K);
const H = Math.round(32 * K) & ~1;   // keep row count even
const pandaPx = [];
for (let y = 0; y < H; y++) {
  const row = [];
  for (let x = 0; x < W; x++) {
    let cov = 0, r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const X = (x + (sx + 0.5) / SS) / K, Y = (y + (sy + 0.5) / SS) / K;
        let col = null;
        for (const L of layers) {
          if (!L.t(X, Y)) continue;
          const c = typeof L.c === "function" ? L.c(X, Y) : L.c;
          if (L.a !== undefined) { if (col) col = col.map((v, i) => v * (1 - L.a) + c[i] * L.a); }
          else col = c;
        }
        if (col) { cov++; r += col[0]; g += col[1]; b += col[2]; }
      }
    }
    row.push(cov / (SS * SS) >= 0.5 ? [r / cov, g / cov, b / cov].map(Math.round) : null);
  }
  pandaPx.push(row);
}

// ---------- half-block renderer ----------
function render(px, w, h) {
  const rows = [];
  for (let y = 0; y < h; y += 2) {
    let s = "";
    for (let x = 0; x < w; x++) {
      const t = px[y]?.[x], b = px[y + 1]?.[x];
      if (t && b) s += fg(t) + bg(b) + "▀";
      else if (t) s += fg(t) + "▀";
      else if (b) s += fg(b) + "▄";
      else s += " ";
      s += RESET;
    }
    rows.push(s);
  }
  return rows;
}

// ---------- wordmark (5x5 pixel font) ----------
const FONT = {
  B: ["####.", "#...#", "####.", "#...#", "####."],
  A: [".###.", "#...#", "#####", "#...#", "#...#"],
  Y: ["#...#", ".#.#.", "..#..", "..#..", "..#.."],
  P: ["####.", "#...#", "####.", "#....", "#...."],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
  D: ["####.", "#...#", "#...#", "#...#", "####."],
};
function word(text) {
  const w = text.length * 6 - 1;
  const px = Array.from({ length: 6 }, () => Array(w).fill(null));
  [...text].forEach((ch, i) => {
    FONT[ch].forEach((line, r) =>
      [...line].forEach((p, c) => {
        if (p !== "#") return;
        const x = i * 6 + c, k = x / w;
        const v = Math.round(255 - 70 * k);
        px[r][x] = [v, v, Math.min(255, v + 8)];
      })
    );
  });
  return render(px, w, 6);
}

const dim = (s) => `\x1b[38;2;140;140;150m${s}${RESET}`;

// ---------- compose ----------
const panda = render(pandaPx, W, H);

/**
 * The banner's right-hand column. `sessionId` is appended as the final line so
 * the session reads as part of the artwork rather than a separate log line.
 */
function rightColumn(sessionId) {
  return [
    ...word("BABY"),
    ...word("PANDA"),
    "",
    dim("─".repeat(29)),
    dim("terminal coding agent"),
    `\x1b[38;2;120;220;160m●${RESET} ` + dim("v0.1.0 · ready"),
    dim(`session ${sessionId}`),
  ];
}

/** One terminal row per line of the composed banner. */
function bannerRows(sessionId) {
  const right = rightColumn(sessionId);
  const off = Math.floor((panda.length - right.length) / 2);
  return panda.map((line, i) => "  " + line + "   " + (right[i - off] ?? ""));
}

/** Prints the banner for `sessionId`. */
function renderBanner(sessionId) {
  console.log();
  for (const row of bannerRows(sessionId)) console.log(row);
  console.log();
}

if (require.main === module) {
  renderBanner(process.argv[2] ?? "");
}