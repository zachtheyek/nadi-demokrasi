// Shared chart engine + section specs — the SINGLE source of truth for both the on-page charts
// (src/main.ts) and the per-section share cards (scripts/prerender.mjs). Because a shared-on-X card
// must look exactly like the website, the drawing logic lives here once: a pure, DOM-free function
// that returns inline-styled SVG markup (inline so it renders identically in the browser AND in
// resvg, which does not resolve CSS classes). main.ts wraps the markup and adds hover; prerender
// composes it into a 1200×630 card under the same heading + headline the page shows.
//
// Nothing here is hard-coded that can be computed — buildSpecs() derives every figure, callout and
// annotation from the rows, exactly as the page does, so the cards self-update with the data.

export const C = { red: "#b3402f", teal: "#2f6f6b", gold: "#c08a2d", slate: "#4f6d7a", ink: "#16130f", muted: "#6b6256", paper: "#fbfaf6", frame: "#cfc7b6",
  // a brighter teal for small highlighted text — the muted line teal is too close to the grey
  // callout colour at label sizes (and the OG renderer ignores tspan bolding, so colour must carry it)
  tealHi: "#1f877c" };

export const num = (v, d = 0) => Number(v).toFixed(d);
export const yy = (year) => "'" + String(year).slice(2);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const at = (rows, year) => rows.find((r) => r.year === year);
function arg(rows, key, dir) {
  let best = null;
  for (const r of rows) {
    const v = r[key];
    if (v == null) continue;
    if (!best || (dir > 0 ? v > best[key] : v < best[key])) best = r;
  }
  return best;
}

/* ---------- derived values (identical to what the page computes) ---------- */
export function computeDerived(rows) {
  const L = rows[rows.length - 1], F = rows[0];
  const gPeak = arg(rows, "gallagher", 1);
  const mPeak = arg(rows, "malapportionment", 1), mLow = arg(rows, "malapportionment", -1);
  const mbPeak = arg(rows, "map_bias", 1), mbLow = arg(rows, "map_bias", -1);
  const cPeak = arg(rows, "compactness", 1), cLow = arg(rows, "compactness", -1);
  const bPeak = arg(rows, "winner_seat_bonus", 1);
  const minorityWins = rows.filter((r) => r.winner_vote_pc < 50 && r.winner_seat_pc > 50);
  const minRecent = minorityWins.length ? minorityWins[minorityWins.length - 1].year : null;
  const bNow = L.winner_seat_bonus;
  const bonusCap = bNow < -0.5 ? "the winner now takes a smaller share of seats than of votes, a reversal from years past."
    : Math.abs(bNow) <= 2 ? "the bonus has all but vanished." : bNow > 0 ? "the winner still gains from the system." : "the bonus has vanished.";
  const firstNeg = rows.filter((r) => r.winner_seat_bonus < 0)[0];
  const isFirstNeg = !!firstNeg && firstNeg.year === L.year;
  const hung = !L.top_blocs.some((b) => b.seat_pc > 50);
  const enpPeak = arg(rows, "enp_seats", 1), enpLow = arg(rows, "enp_seats", -1);
  const volRanked = rows.filter((r) => r.volatility != null).sort((a, b) => (b.volatility - a.volatility));
  const volTop = volRanked.slice(0, 3);
  const volDips = volRanked.slice(-2);
  const volContext = {
    1959: "opposition emerges", 1982: "BN unchallenged", 1990: "UMNO splits",
    1999: "Reformasi", 2008: "political tsunami", 2013: "BN–PR rematch",
  };
  const r2008 = at(rows, 2008);
  const tPeak = arg(rows, "turnout", 1), tLow = arg(rows, "turnout", -1);
  const tPrev = rows[rows.length - 2];
  const tDrop = (tPrev.turnout != null && L.turnout != null) ? (tPrev.turnout - L.turnout) : 0;
  const belowHalf = rows.find((r) => r.winner_vote_pc < 50);
  let lastAbove = -1;
  rows.forEach((r, i) => { if (r.winner_seat_pc >= 200 / 3) lastAbove = i; });
  const twoThirdsYr = (lastAbove >= 0 && lastAbove < rows.length - 1) ? rows[lastAbove + 1].year : null;
  const big3 = L.top_blocs.slice(0, 3);
  const candLow = arg(rows, "cand_per_seat", -1), candPeak = arg(rows, "cand_per_seat", 1);
  const margPeak = arg(rows, "marginal_pc", 1);
  const wPeak = arg(rows, "women_pc", 1);
  const toPeak = arg(rows, "turnover", 1), toLow = arg(rows, "turnover", -1);
  return { L, F, gPeak, mPeak, mLow, mbPeak, mbLow, cPeak, cLow, bPeak, minorityWins, minRecent, bNow, bonusCap, isFirstNeg, hung,
    enpPeak, enpLow, volTop, volDips, volContext, r2008, tPeak, tLow, tPrev, tDrop, belowHalf,
    twoThirdsYr, big3, candLow, candPeak, margPeak, wPeak, toPeak, toLow };
}

/* ---------- per-section chart specs + headings (id, h2, q, now, nowCap, share, opts) ---------- */
export function buildSpecs(rows) {
  const d = computeDerived(rows), { L, F } = d;
  return [
    {
      id: "disproportionality", h2: "Disproportionality", q: "How faithfully do votes turn into seats?",
      now: num(L.gallagher, 1),
      nowCap: `the gap between how Malaysians voted and the seats they got in ${L.year} — near its narrowest ever, down from a peak of ${num(d.gPeak.gallagher, 1)} in ${d.gPeak.year}.`,
      share: `Malaysia's vote-to-seat disproportionality (Gallagher) peaked at ${num(d.gPeak.gallagher, 1)} in ${d.gPeak.year} and has fallen to ${num(L.gallagher, 1)} by ${L.year}.`,
      opts: {
        series: [{ label: "Gallagher", color: C.red, focal: true, y: (r) => r.gallagher }],
        yLabel: "Gallagher disproportionality", fmt: (v) => num(v, 1), yMin: 0,
        yRefs: [{ at: 2, to: 5, label: "typical PR systems" }, { at: 12, label: "high by world standards" }],
        points: [{ year: d.gPeak.year, value: d.gPeak.gallagher, tag: "peak" }, { year: L.year, value: L.gallagher, tag: "now", place: "below" }],
      },
    },
    {
      id: "seat-bonus", h2: "The winner's bonus", q: "How much does the system inflate the largest bloc?",
      now: (L.winner_seat_bonus >= 0 ? "+" : "") + num(L.winner_seat_bonus, 1),
      nowCap: `percentage-point gap between the winner's seat share and vote share in ${L.year} — ${d.bonusCap}`,
      share: `First-past-the-post once handed Malaysia's election winner up to +${num(d.bPeak.winner_seat_bonus, 1)} points of seat bonus (${d.bPeak.year}). By ${L.year} it had vanished (${num(L.winner_seat_bonus, 1)}).`,
      opts: {
        series: [
          { label: "Seat share", color: C.red, focal: true, y: (r) => r.winner_seat_pc },
          { label: "Vote share", color: C.teal, y: (r) => r.winner_vote_pc },
        ],
        yLabel: "Winner's seat share vs vote share", fmt: (v) => num(v) + "%", yMin: 0, yMax: 100,
        gapFill: true, gap: { year: d.bPeak.year, label: "+" + num(d.bPeak.winner_seat_bonus, 1) + " pp bonus" },
        // the "won on 46%" vote figure lives on the teal line, so tint it teal
        points: d.minorityWins.map((r) => ({ year: r.year, value: r.winner_seat_pc, tag: "won on " + num(r.winner_vote_pc) + "%", place: (r.winner_seat_pc > 61 ? "below" : "above"), hi: num(r.winner_vote_pc) + "%", hiColor: C.tealHi })),
      },
    },
    {
      id: "malapportionment", h2: "Malapportionment", q: "Is every vote worth the same?",
      now: num(L.malapportionment ?? 0, 1) + "%",
      nowCap: `of seats are mis-allocated relative to one-person-one-vote in ${L.year} — a record, and extreme by world standards.`,
      share: `${num(L.malapportionment ?? 0, 1)}% of Malaysia's parliamentary seats are mis-allocated relative to one-person-one-vote (${L.year}) — among the most malapportioned democracies in the world.`,
      opts: {
        series: [{ label: "MAL", color: C.red, focal: true, y: (r) => r.malapportionment }],
        yLabel: "Malapportionment index", fmt: (v) => num(v, 1) + "%", yMin: 0,
        yRefs: [{ at: 0, to: 5, label: "most democracies ≤ 5%" }, { at: 15, label: "among the most malapportioned", label2: "globally", side: "right" }],
        points: [{ year: d.mLow.year, value: d.mLow.malapportionment ?? 0, tag: "lowest", place: "below" }, { year: d.mPeak.year, value: d.mPeak.malapportionment ?? 0, tag: "peak" }],
      },
    },
    {
      id: "map-bias", h2: "Who the map favours", q: "Do the over-represented seats break one way?",
      now: (d.L.map_bias >= 0 ? "+" : "−") + num(Math.abs(d.L.map_bias ?? 0), 0) + "%",
      nowCap: d.L.map_bias >= 0
        ? `the winning bloc's seats each held about ${num(Math.abs(d.L.map_bias ?? 0), 0)}% fewer voters than the average seat in ${d.L.year} — the unequal map favoured the winner.`
        : `the winning bloc's seats each held about ${num(Math.abs(d.L.map_bias ?? 0), 0)}% more voters than the average seat in ${d.L.year} — the unequal map worked against the winner, not for it.`,
      share: `Malaysia's unequal map once handed the winner its smallest seats; by ${d.L.year} that flipped — the winning bloc's seats held about ${num(Math.abs(d.L.map_bias ?? 0), 0)}% ${d.L.map_bias >= 0 ? "fewer" : "more"} voters than average, so the rural-weighted map now works against whoever wins the vote.`,
      opts: {
        series: [{ label: "Map bias", color: C.red, focal: true, y: (r) => r.map_bias }],
        yLabel: "Winner's seat-size advantage", fmt: (v) => (v >= 0 ? "+" : "−") + num(Math.abs(v), 0) + "%",
        // generous head/foot room so the peak callout sits clear ABOVE the peak and the latest
        // callout clear BELOW the trough, instead of colliding with the steep line
        yMax: Math.ceil(d.mbPeak.map_bias ?? 0) + 10, yMin: Math.floor(d.mbLow.map_bias ?? 0) - 12,
        yRefs: [{ at: 0, label: "no tilt" }],
        points: [
          { year: d.mbPeak.year, value: d.mbPeak.map_bias, tag: "peak tilt to winner", place: "above" },
          { year: d.L.year, value: d.L.map_bias, tag: "now", place: "below" },
        ],
      },
    },
    {
      id: "compactness", h2: "District shapes", q: "How irregular are the boundaries?",
      now: num(d.L.compactness ?? 0, 2),
      nowCap: `average compactness of a parliamentary seat in ${d.L.year} (Polsby–Popper; 1 = a perfect circle) — the least compact boundaries on record, after the latest redelineation.`,
      share: `Malaysia's parliamentary boundaries are the least compact on record: average Polsby–Popper compactness fell to ${num(d.L.compactness ?? 0, 2)} in ${d.L.year} (1 = a circle), after the latest redelineation redrew the most irregular seats in its history.`,
      opts: {
        series: [{ label: "Compactness", color: C.red, focal: true, y: (r) => r.compactness }],
        yLabel: "District compactness (Polsby–Popper)", fmt: (v) => num(v, 2), yMin: 0.25, yMax: 0.42,
        points: [
          { year: d.cPeak.year, value: d.cPeak.compactness, tag: "most compact" },
          { year: d.L.year, value: d.L.compactness, tag: "least compact", place: "below" },
        ],
      },
    },
    {
      id: "dominance", h2: "The end of the majority party", q: "Is anyone still dominant?",
      now: num(L.winner_vote_pc) + "%",
      nowCap: `the winning bloc's vote share in ${L.year} — the lowest in our history.`,
      share: `The vote share of Malaysia's winning bloc has fallen from ${num(F.winner_vote_pc)}% (${F.year}) to just ${num(L.winner_vote_pc)}% (${L.year}) — the end of the dominant-party era.`,
      opts: {
        series: [{ label: "Winner %", color: C.red, focal: true, y: (r) => r.winner_vote_pc }],
        yLabel: "Winner's vote share", fmt: (v) => num(v) + "%", yMin: 0, yMax: 90,
        yRefs: [{ at: 50, label: "majority" }, { at: 200 / 3, label: "supermajority" }],
        points: [
          { year: F.year, value: F.winner_vote_pc, tag: "high", place: "right" },
          ...(d.belowHalf ? [{ year: d.belowHalf.year, value: d.belowHalf.winner_vote_pc, tag: "fell below half for the first time", place: "below" }] : []),
          { year: L.year, value: L.winner_vote_pc, tag: "low", place: "below" },
        ],
      },
    },
    {
      id: "fragmentation", h2: "Fragmentation", q: "How many parties really matter?",
      now: num(L.enp_seats, 1),
      nowCap: `effective number of parliamentary parties in ${L.year} — the most fragmented in our history.`,
      share: `Malaysia's effective number of parliamentary parties has risen from about ${num(d.enpLow.enp_seats, 1)} to a record ${num(L.enp_seats, 1)} (${L.year}) — from a one-party-dominant system to a genuine multi-bloc contest.`,
      opts: {
        series: [
          { label: "By seats", color: C.red, focal: true, y: (r) => r.enp_seats },
          { label: "By votes", color: C.gold, y: (r) => r.enp_votes },
        ],
        yLabel: "Effective number of parties", fmt: (v) => num(v, 1), yMin: 0.8,
        points: [{ year: d.enpLow.year, value: d.enpLow.enp_seats, tag: "one-party low", place: "below" }, { year: d.enpPeak.year, value: d.enpPeak.enp_seats, tag: "record" }],
      },
    },
    {
      id: "multi-cornered", h2: "Multi-cornered contests", q: "How many names on the ballot?",
      now: num(L.cand_per_seat, 1),
      nowCap: `candidates on the average ballot in ${L.year} — ${num(L.three_plus_pc)}% of seats were three-cornered or more.`,
      share: `Malaysia's ballots have crowded: the average federal seat drew ${num(L.cand_per_seat, 1)} candidates in ${L.year} (up from about 2 in the two-coalition era), and ${num(L.three_plus_pc)}% of seats were three-cornered or more.`,
      opts: {
        series: [{ label: "Candidates", color: C.red, focal: true, y: (r) => r.cand_per_seat }],
        yLabel: "Candidates per seat", fmt: (v) => num(v, 1), yMin: 2,
        points: [{ year: d.candLow.year, value: d.candLow.cand_per_seat, tag: "fewest", place: "below" }, { year: d.candPeak.year, value: d.candPeak.cand_per_seat, tag: "peak" }],
      },
    },
    {
      id: "volatility", h2: "Volatility", q: "How much does the vote move between elections?",
      now: num(L.volatility ?? 0),
      nowCap: `how much the vote shifted between blocs from the previous election, in ${L.year} — one of the largest realignments on record.`,
      share: `Malaysia's biggest electoral realignments by vote-share (Pedersen volatility): ${d.volTop.map((r) => r.year).sort((a, b) => a - b).join(", ")}${L.volatility === d.volTop[0].volatility ? "" : `, with ${L.year} among them`}.`,
      opts: {
        series: [{ label: "Pedersen", color: C.teal, focal: true, y: (r) => r.volatility }],
        yLabel: "Electoral volatility", fmt: (v) => num(v), yMax: Math.max(...rows.map((r) => r.volatility ?? 0)) * 1.35,
        xLines: at(rows, 2008) ? [{ year: 2008, label: `${yy(2008)} ${d.volContext[2008]}` }] : [],
        points: [
          ...d.volTop.map((r) => ({ year: r.year, value: r.volatility, tag: d.volContext[r.year] ?? "" })),
          ...d.volDips.slice().sort((a, b) => a.year - b.year).map((r, i) => ({ year: r.year, value: r.volatility, tag: d.volContext[r.year] ?? "", place: (i === 0 ? "left" : "right") })),
        ],
      },
    },
    {
      id: "turnover", h2: "Seat turnover", q: "How many seats flip between elections?",
      now: num(L.turnover ?? 0) + "%",
      nowCap: `of seats changed hands in ${L.year} — the highest churn on record, more than half the House.`,
      share: `${num(L.turnover ?? 0)}% of Malaysian seats changed hands in ${L.year} — the highest turnover on record, as Perikatan Nasional surged and Barisan Nasional collapsed.`,
      opts: {
        series: [{ label: "Seats flipped", color: C.red, focal: true, y: (r) => r.turnover }],
        yLabel: "Share of seats that changed bloc", fmt: (v) => num(v) + "%", yMin: 0,
        xLines: at(rows, 2008) ? [{ year: 2008, label: `${yy(2008)} tsunami` }] : [],
        points: [{ year: d.toLow.year, value: d.toLow.turnover ?? 0, tag: "quietest", place: "below" }, { year: d.toPeak.year, value: d.toPeak.turnover ?? 0, tag: "record" }],
      },
    },
    {
      id: "marginal", h2: "Marginal seats", q: "How close are the contests?",
      now: num(L.marginal_pc, 1) + "%",
      nowCap: `of seats in ${L.year} were won by less than 5 points — about one in ${Math.round(100 / L.marginal_pc)} seats.`,
      share: `About one in ${Math.round(100 / L.marginal_pc)} Malaysian seats is now a knife-edge: ${num(L.marginal_pc, 1)}% were won by under 5 points in ${L.year}, far above the norm for most of the country's history.`,
      opts: {
        series: [{ label: "Marginal", color: C.red, focal: true, y: (r) => r.marginal_pc }],
        yLabel: "Share of marginal seats", fmt: (v) => num(v, 1) + "%", yMin: 0,
        points: [{ year: d.margPeak.year, value: d.margPeak.marginal_pc, tag: "peak" }, { year: L.year, value: L.marginal_pc, tag: "now", place: "below" }],
      },
    },
    {
      id: "turnout", h2: "Turnout", q: "Do Malaysians show up?",
      now: num(L.turnout ?? 0) + "%",
      nowCap: `turnout in ${L.year}, the first election with automatic registration and voting at 18.`,
      share: `Malaysian turnout has held between ${num(d.tLow.turnout ?? 0)}% and ${num(d.tPeak.turnout ?? 0)}% for seven decades, peaking at ${num(d.tPeak.turnout ?? 0)}% in ${d.tPeak.year}.`,
      opts: {
        series: [{ label: "Turnout", color: C.gold, focal: true, y: (r) => r.turnout }],
        yLabel: "Voter turnout", fmt: (v) => num(v) + "%", yMin: 60, yMax: 90,
        points: [{ year: d.tLow.year, value: d.tLow.turnout ?? 0, tag: "low", place: "below" }, { year: d.tPeak.year, value: d.tPeak.turnout ?? 0, tag: "peak" }, { year: L.year, value: L.turnout ?? 0, tag: "now", place: "below" }],
      },
    },
    {
      id: "women", h2: "Women in Parliament", q: "Who actually gets elected?",
      now: num(L.women_pc, 1) + "%",
      nowCap: `of MPs elected in ${L.year} were women — a chamber that looks little like the electorate it answers to.`,
      share: `Malaysia's Parliament is ${num(L.women_pc, 1)}% women (${L.year}) — up from near-zero in ${F.year}, but still well below the ~30% many democracies treat as a floor.`,
      opts: {
        series: [{ label: "Women MPs", color: C.red, focal: true, y: (r) => r.women_pc }],
        yLabel: "Share of women MPs", fmt: (v) => num(v, 1) + "%", yMin: 0,
        yRefs: [{ at: 30, label: "~30% common benchmark" }],
        points: [{ year: F.year, value: F.women_pc, tag: "near zero" }, { year: d.wPeak.year, value: d.wPeak.women_pc, tag: "peak" }, { year: L.year, value: L.women_pc, tag: "now", place: "below" }],
      },
    },
    {
      id: "ethnicity", h2: "Parliament's ethnic makeup", q: "Does the chamber mirror the country?",
      now: num(L.chinese_pc) + "%",
      nowCap: `of MPs elected in ${L.year} were ethnic Chinese — down from about ${num(F.chinese_pc)}% at independence, the chamber's sharpest ethnic shift.`,
      share: `The ethnic makeup of Malaysia's Parliament has shifted: ethnic-Chinese MPs fell from about ${num(F.chinese_pc)}% (${F.year}) to ${num(L.chinese_pc)}% (${L.year}), while Malay MPs rose to ${num(L.malay_pc)}%.`,
      opts: {
        series: [
          { label: "Chinese", color: C.red, focal: true, y: (r) => r.chinese_pc },
          { label: "Malay", color: C.teal, y: (r) => r.malay_pc },
          { label: "S&S Bumi", color: C.gold, y: (r) => r.em_bumi_pc },
          { label: "Indian", color: C.slate, y: (r) => r.indian_pc },
        ],
        yLabel: "Ethnic makeup of MPs", fmt: (v) => num(v) + "%", yMin: 0,
      },
    },
  ];
}

/* ---------- the Tufte line chart (pure; returns inline-styled markup + the x/y scales) ----------
   Styling is INLINE (not CSS classes) so the identical markup renders in the browser and in resvg.
   Returns { g, x, y }: g is the inner SVG (drop into <svg>…</svg>), x/y are the scales the page uses
   to place hover dots. */
export function chartSVG(rows, o, W, H) {
  const m = { t: 28, r: 96, b: 28, l: 38 };
  const years = rows.map((r) => r.year);
  const xMin = Math.min(...years), xMax = Math.max(...years);
  const all = o.series.flatMap((s) => rows.map(s.y).filter((v) => v != null));
  const refVals = (o.yRefs || []).flatMap((r) => (r.to != null ? [r.at, r.to] : [r.at]));
  const pool = all.concat(refVals);
  const hi = o.yMax ?? Math.max(...pool) * 1.16;
  const lo = o.yMin ?? Math.min(0, Math.min(...pool));
  const plotTop = m.t, plotBot = H - m.b, plotRight = W - m.r;
  const x = (yr) => m.l + (yr - xMin) / (xMax - xMin) * (plotRight - m.l);
  const y = (v) => plotBot - (v - lo) / (hi - lo) * (plotBot - plotTop);
  const clampY = (v) => Math.max(plotTop + 8, Math.min(plotBot - 4, v));

  let g = "";
  const placed = [];
  const fits = (b) => !placed.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);
  const reserveL = (cx, w, cy, anchor) => {
    const x0 = anchor === "end" ? cx - w : anchor === "middle" ? cx - w / 2 : cx;
    placed.push({ x0, x1: x0 + w, y0: cy - 10, y1: cy + 3 });
  };
  const FF = 'font-family="Space Grotesk"';
  const txt = (tx, ty, anchor, extra, s) => `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}" ${FF} ${extra}>${esc(s)}</text>`;
  const reflab = (lx, ly, anchor, s) => txt(lx, ly, anchor, `fill="${C.muted}" font-size="10.5" font-style="italic"`, s);
  const axt = (tx, ty, anchor, s) => txt(tx, ty, anchor, `fill="${C.muted}" font-size="11"`, s);

  // shaded period bands (faintest layer)
  (o.xBands || []).forEach((b) => {
    const x0 = x(Math.max(b.from, xMin)), x1 = x(Math.min(b.to, xMax));
    g += `<rect x="${x0.toFixed(1)}" y="${plotTop}" width="${(x1 - x0).toFixed(1)}" height="${(plotBot - plotTop).toFixed(1)}" fill="rgba(107,98,86,.06)"/>`;
    if (b.label) { const lx = (x0 + x1) / 2, ly = plotTop - 8; g += txt(lx, ly, "middle", `fill="${C.muted}" font-size="10.5" font-weight="600"`, b.label); reserveL(lx, b.label.length * 5.9, ly, "middle"); }
  });

  // horizontal reference lines / bands — labels sit BELOW the line, left by default (right on request)
  (o.yRefs || []).forEach((r) => {
    const right = r.side === "right";
    const lx = right ? plotRight - 4 : m.l + 5, anchor = right ? "end" : "start";
    if (r.to != null) {
      const ya = y(r.at), yb = y(r.to);
      g += `<rect x="${m.l}" y="${Math.min(ya, yb).toFixed(1)}" width="${(plotRight - m.l).toFixed(1)}" height="${Math.abs(ya - yb).toFixed(1)}" fill="rgba(47,111,107,.07)"/>`;
      const ly = (ya + yb) / 2 + 3;
      g += reflab(lx, ly, anchor, r.label);
      reserveL(lx, r.label.length * 5.3, ly, anchor);
    } else {
      const yr = y(r.at), ly = yr + 14;
      g += `<line x1="${m.l}" y1="${yr.toFixed(1)}" x2="${plotRight.toFixed(1)}" y2="${yr.toFixed(1)}" stroke="${C.muted}" stroke-dasharray="3 4" stroke-width="1" opacity=".6"/>`;
      g += reflab(lx, ly, anchor, r.label);
      reserveL(lx, r.label.length * 5.3, ly, anchor);
      if (r.label2) {
        const ly2 = ly + 12;
        g += reflab(lx, ly2, anchor, r.label2);
        reserveL(lx, r.label2.length * 5.3, ly2, anchor);
      }
    }
  });

  // vertical reference lines (a named event year) — dashed, label at the top
  (o.xLines || []).forEach((xl) => {
    const vx = x(xl.year);
    g += `<line x1="${vx.toFixed(1)}" y1="${(plotTop + 4).toFixed(1)}" x2="${vx.toFixed(1)}" y2="${plotBot.toFixed(1)}" stroke="${C.muted}" stroke-dasharray="3 3" stroke-width="1" opacity=".55"/>`;
    g += txt(vx, plotTop - 2, "middle", `fill="${C.muted}" font-size="10.5" font-weight="600"`, xl.label);
    reserveL(vx, xl.label.length * 5.5, plotTop - 2, "middle");
  });

  // range-frame axes (thin) + min/max y ticks
  g += `<line x1="${m.l}" y1="${plotTop}" x2="${m.l}" y2="${plotBot}" stroke="${C.frame}" stroke-width="1"/>`;
  g += `<line x1="${m.l}" y1="${plotBot}" x2="${plotRight.toFixed(1)}" y2="${plotBot}" stroke="${C.frame}" stroke-width="1"/>`;
  g += axt(m.l - 6, plotTop + 4, "end", o.fmt(hi));
  g += axt(m.l - 6, plotBot + 3, "end", o.fmt(lo));
  rows.forEach((r, i) => { if (i % 2 === 0 || i === rows.length - 1) g += axt(x(r.year), H - 8, "middle", yy(r.year)); });

  // gap fill between two series (the seat bonus / squeeze, shown directly)
  if (o.gapFill && o.series.length === 2) {
    const pa = rows.map((r) => ({ yr: r.year, v: o.series[0].y(r) })).filter((p) => p.v != null);
    const pb = rows.map((r) => ({ yr: r.year, v: o.series[1].y(r) })).filter((p) => p.v != null);
    if (pa.length && pa.length === pb.length) {
      const top = pa.map((p) => `${x(p.yr).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
      const bot = pb.slice().reverse().map((p) => `${x(p.yr).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
      g += `<polygon points="${top} ${bot}" fill="rgba(179,64,47,.06)"/>`;
    }
  }

  // series lines + hover targets; collect end points for de-collided name labels
  const ends = [];
  o.series.forEach((s) => {
    const pts = rows.map((r) => ({ r, v: s.y(r) })).filter((p) => p.v != null);
    if (!pts.length) return;
    const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.r.year).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    g += `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="${s.focal ? 2.6 : 1.8}" stroke-linejoin="round" stroke-linecap="round"/>`;
    g += pts.map((p) => `<circle class="dot" cx="${x(p.r.year).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="14" fill="transparent" data-y="${p.r.year}" data-v="${p.v}" data-l="${esc(s.label)}" data-w="${esc(p.r.winner)}"/>`).join("");
    const e = pts[pts.length - 1];
    g += `<circle cx="${x(e.r.year).toFixed(1)}" cy="${y(e.v).toFixed(1)}" r="${s.focal ? 3.4 : 3}" fill="${s.color}"/>`;
    ends.push({ yPt: y(e.v), color: s.color, label: s.label });
  });
  ends.sort((a, b) => a.yPt - b.yPt);
  let prev = -1e9;
  ends.forEach((e) => {
    let ly = clampY(e.yPt); if (ly - prev < 14) ly = prev + 14; prev = ly;
    if (Math.abs(ly - e.yPt) > 2) g += `<line x1="${(plotRight + 3).toFixed(1)}" y1="${e.yPt.toFixed(1)}" x2="${(plotRight + 7).toFixed(1)}" y2="${ly.toFixed(1)}" stroke="${C.frame}" stroke-width="1"/>`;
    g += txt(plotRight + 9, ly + 3.5, "start", `fill="${e.color}" font-size="11" font-weight="600"`, e.label);
    reserveL(plotRight + 9, e.label.length * 6.2, ly + 3.5, "start");
  });

  // gap connector between two series at a given year (the peak seat bonus) — two-line tag
  if (o.gap && o.series.length === 2) {
    const r = at(rows, o.gap.year); if (r) {
      const va = o.series[0].y(r), vb = o.series[1].y(r);
      const gx = x(o.gap.year), ya = y(va), yb = y(vb);
      g += `<line x1="${gx.toFixed(1)}" y1="${ya.toFixed(1)}" x2="${gx.toFixed(1)}" y2="${yb.toFixed(1)}" stroke="${C.ink}" stroke-width="1.4"/>`;
      const gw = Math.max(o.gap.label.length, 4) * 6.4;
      let ty = clampY(Math.min(ya, yb) - 28);
      for (let k = 0; k < 5; k++) { if (fits({ x0: gx - gw / 2, x1: gx + gw / 2, y0: ty - 10, y1: ty + 19 })) break; ty = clampY(ty - 12); }
      g += txt(gx, ty, "middle", `fill="${C.ink}" font-size="11.5" font-weight="700"`, o.gap.label);
      g += txt(gx, ty + 16, "middle", `fill="${C.muted}" font-size="10.5"`, yy(o.gap.year));
      reserveL(gx, gw, ty, "middle");
      reserveL(gx, gw, ty + 16, "middle");
    }
  }

  // labelled point callouts (peaks / dips / notable)
  (o.points || []).forEach((p) => {
    const s = o.series.find((ss) => ss.y(at(rows, p.year)) != null) || o.series[0];
    const cx = x(p.year), cy = y(p.value);
    const tag = p.tag ? `${yy(p.year)} (${p.tag})` : yy(p.year);
    const w = Math.max(o.fmt(p.value).length * 6.4, tag.length * 5.7);
    const drawDot = () => `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="${s.color}"/>`;
    // the tag is muted, but an optional substring (p.hi) can be tinted + bolded — e.g. a vote % that
    // lives on the other (teal) line gets that line's colour, and bold so it reads at small sizes
    const tagInner = p.hi ? esc(tag).replace(esc(p.hi), `<tspan fill="${p.hiColor || C.teal}" font-weight="700">${esc(p.hi)}</tspan>`) : esc(tag);
    const drawText = (tx, vY, sY, anchor) =>
      txt(tx, vY, anchor, `fill="${s.color}" font-size="12.5" font-weight="700"`, o.fmt(p.value)) +
      `<text x="${tx.toFixed(1)}" y="${sY.toFixed(1)}" text-anchor="${anchor}" ${FF} fill="${C.muted}" font-size="10.5">${tagInner}</text>`;

    if (p.place === "left" || p.place === "right") {
      const dir = p.place === "left" ? -1 : 1;
      const anchor = p.place === "left" ? "end" : "start";
      const tx = cx + dir * 9;
      let vY = cy - 3, sY = cy + 9;
      const x0 = p.place === "left" ? tx - w : tx, x1 = p.place === "left" ? tx : tx + w;
      for (let k = 0; k < 8; k++) { if (fits({ x0, x1, y0: vY - 10, y1: sY + 3 })) break; vY += 13; sY += 13; }
      vY = clampY(vY); sY = vY + 12;
      placed.push({ x0, x1, y0: vY - 10, y1: sY + 3 });
      g += drawDot();
      g += `<line x1="${(cx + dir * 5).toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(tx - dir * 2).toFixed(1)}" y2="${((vY + sY) / 2).toFixed(1)}" stroke="${C.frame}" stroke-width="1"/>`;
      g += drawText(tx, vY, sY, anchor);
      return;
    }

    const atRight = p.year === xMax, atLeft = p.year === xMin;
    const anchor = atRight ? "end" : atLeft ? "start" : "middle";
    const tx = atRight ? cx - 7 : atLeft ? cx + 7 : cx;
    const x0 = atRight ? tx - w : atLeft ? tx : tx - w / 2, x1 = atRight ? tx : atLeft ? tx + w : tx + w / 2;
    let place = p.place || "above";
    if (place === "above" && cy - 30 < plotTop) place = "below";
    if (place === "below" && cy + 30 > plotBot) place = "above";
    let vY = place === "above" ? cy - 26 : cy + 15;
    if (place === "below" && o.series.length > 1) {
      const rr = at(rows, p.year);
      if (rr) {
        const lower = o.series.map((ss) => ss.y(rr)).filter((v) => v != null).filter((v) => v < p.value);
        if (lower.length) vY = Math.max(vY, y(Math.min(...lower)) + 16);
      }
    }
    for (let k = 0; k < 8; k++) { if (fits({ x0, x1, y0: vY - 11, y1: vY + 13 })) break; vY += place === "above" ? -13 : 13; }
    vY = clampY(vY);
    const sY = vY + 12;
    placed.push({ x0, x1, y0: vY - 11, y1: sY + 3 });
    g += drawDot();
    g += `<line x1="${cx.toFixed(1)}" y1="${(cy + (place === "above" ? -5 : 5)).toFixed(1)}" x2="${tx.toFixed(1)}" y2="${(place === "above" ? sY + 2 : vY - 10).toFixed(1)}" stroke="${C.frame}" stroke-width="1"/>`;
    g += drawText(tx, vY, sY, anchor);
  });

  return { g, x, y };
}
