// Per-section share cards. For each indicator we render a standalone 1200×630 OG image of that
// section's PLOT (title + headline + the chart itself) and a tiny prerendered page carrying its
// OG meta, so a shared section link delivers the plot directly. The section "Share" button points
// at /s/<id>/; a human visitor is redirected to the main page's section.
//
// NOTE: the specs below mirror the chart shape of `sections()` in src/main.ts (title, headline,
// series + colours). Keep them in step when a section's chart changes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const rows = JSON.parse(readFileSync("public/data/indicators.json", "utf8")).rows;
const L = rows[rows.length - 1], F = rows[0];
const num = (v, d = 0) => Number(v).toFixed(d);
const C = { red: "#b3402f", teal: "#2f6f6b", gold: "#c08a2d", slate: "#4f6d7a", ink: "#16130f", muted: "#6b6256", paper: "#fbfaf6" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pct = (v) => num(v) + "%", pct1 = (v) => num(v, 1) + "%", d1 = (v) => num(v, 1), d0 = (v) => num(v);

// each: title, now (headline), cap, series [{key,color,label}], fmt, yMin/yMax, refs, summary
const specs = [
  { id: "disproportionality", title: "Disproportionality", now: num(L.gallagher, 1), cap: `Gallagher index, ${L.year}`, fmt: d1, yMin: 0, refs: [{ at: 2, to: 5 }, { at: 12 }], series: [{ key: "gallagher", color: C.red, label: "Gallagher" }], summary: `Malaysia's vote-to-seat gap (Gallagher) is near its narrowest ever — ${num(L.gallagher, 1)} in ${L.year}, down from a peak of 24.0 in 2004.` },
  { id: "seat-bonus", title: "The winner's bonus", now: (L.winner_seat_bonus >= 0 ? "+" : "") + num(L.winner_seat_bonus, 1), cap: `winner's seat−vote gap, ${L.year}`, fmt: pct, yMin: 0, yMax: 100, series: [{ key: "winner_seat_pc", color: C.red, label: "Seats" }, { key: "winner_vote_pc", color: C.teal, label: "Votes" }], summary: `First-past-the-post once handed the winner up to +27 points of seats. By ${L.year} the gap has vanished (${num(L.winner_seat_bonus, 1)}).` },
  { id: "malapportionment", title: "Malapportionment", now: num(L.malapportionment, 1) + "%", cap: `seats mis-allocated vs one-person-one-vote, ${L.year}`, fmt: pct1, yMin: 0, refs: [{ at: 0, to: 5 }, { at: 15 }], series: [{ key: "malapportionment", color: C.red, label: "MAL" }], summary: `${num(L.malapportionment, 1)}% of Malaysia's seats are mis-allocated relative to one-person-one-vote — among the most malapportioned democracies in the world.` },
  { id: "dominance", title: "The end of the majority party", now: num(L.winner_vote_pc) + "%", cap: `winning bloc's vote share, ${L.year}`, fmt: pct, yMin: 0, yMax: 90, series: [{ key: "winner_vote_pc", color: C.red, label: "Winner" }], summary: `The winning bloc's vote share has fallen from ${num(F.winner_vote_pc)}% (${F.year}) to ${num(L.winner_vote_pc)}% (${L.year}) — the end of the dominant-party era.` },
  { id: "fragmentation", title: "Fragmentation", now: num(L.enp_seats, 1), cap: `effective parliamentary parties, ${L.year}`, fmt: d1, yMin: 0.8, series: [{ key: "enp_seats", color: C.red, label: "Seats" }, { key: "enp_votes", color: C.gold, label: "Votes" }], summary: `The effective number of parliamentary parties has risen to a record ${num(L.enp_seats, 1)} (${L.year}) — a genuine multi-bloc contest.` },
  { id: "multi-cornered", title: "Multi-cornered contests", now: num(L.cand_per_seat, 1), cap: `candidates on the average ballot, ${L.year}`, fmt: d1, yMin: 2, series: [{ key: "cand_per_seat", color: C.red, label: "Candidates" }], summary: `Malaysia's ballots have crowded: ${num(L.cand_per_seat, 1)} candidates on the average seat in ${L.year}, and ${num(L.three_plus_pc)}% three-cornered or more.` },
  { id: "volatility", title: "Volatility", now: num(L.volatility), cap: `vote shift between blocs, ${L.year}`, fmt: d0, yMin: 0, series: [{ key: "volatility", color: C.teal, label: "Pedersen" }], summary: `${num(L.volatility)} in ${L.year} — one of Malaysia's largest electoral realignments on record.` },
  { id: "turnover", title: "Seats changing hands", now: num(L.turnover) + "%", cap: `seats that flipped bloc, ${L.year}`, fmt: pct, yMin: 0, series: [{ key: "turnover", color: C.red, label: "Flipped" }], summary: `${num(L.turnover)}% of seats changed hands in ${L.year} — the highest turnover on record.` },
  { id: "marginal", title: "Marginal seats", now: num(L.marginal_pc, 1) + "%", cap: `seats won by under 5 points, ${L.year}`, fmt: pct1, yMin: 0, series: [{ key: "marginal_pc", color: C.red, label: "Marginal" }], summary: `About one in ${Math.round(100 / L.marginal_pc)} Malaysian seats is a knife-edge — ${num(L.marginal_pc, 1)}% won by under 5 points in ${L.year}.` },
  { id: "turnout", title: "Turnout", now: num(L.turnout) + "%", cap: `voter turnout, ${L.year}`, fmt: pct, yMin: 60, yMax: 90, series: [{ key: "turnout", color: C.gold, label: "Turnout" }], summary: `Malaysian turnout has held between 69% and 84% for seven decades, at ${num(L.turnout)}% in ${L.year}.` },
  { id: "women", title: "Women in Parliament", now: num(L.women_pc, 1) + "%", cap: `share of MPs who are women, ${L.year}`, fmt: pct1, yMin: 0, refs: [{ at: 30 }], series: [{ key: "women_pc", color: C.red, label: "Women MPs" }], summary: `Malaysia's Parliament is ${num(L.women_pc, 1)}% women (${L.year}) — up from near-zero in ${F.year}, but below the ~30% many democracies treat as a floor.` },
  { id: "ethnicity", title: "Parliament's ethnic makeup", now: num(L.chinese_pc) + "%", cap: `share of MPs who are ethnic Chinese, ${L.year}`, fmt: pct, yMin: 0, series: [{ key: "chinese_pc", color: C.red, label: "Chinese" }, { key: "malay_pc", color: C.teal, label: "Malay" }, { key: "em_bumi_pc", color: C.gold, label: "S&S Bumi" }, { key: "indian_pc", color: C.slate, label: "Indian" }], summary: `Ethnic-Chinese MPs have fallen from about ${num(F.chinese_pc)}% (${F.year}) to ${num(L.chinese_pc)}% (${L.year}), while Malay MPs rose to ${num(L.malay_pc)}%.` },
];

function chartSVG(sp, X, Y, W, H) {
  const m = { t: 16, r: 108, b: 30, l: 52 };
  const years = rows.map((r) => r.year), xMin = Math.min(...years), xMax = Math.max(...years);
  const vals = sp.series.flatMap((s) => rows.map((r) => r[s.key]).filter((v) => v != null));
  const refv = (sp.refs || []).flatMap((r) => (r.to != null ? [r.at, r.to] : [r.at]));
  const hi = sp.yMax ?? Math.max(...vals, ...refv) * 1.12;
  const lo = sp.yMin ?? Math.min(0, ...vals);
  const px = (yr) => X + m.l + (yr - xMin) / (xMax - xMin) * (W - m.l - m.r);
  const py = (v) => Y + H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b);
  const T = (x, y, s, sz, col, w = 400, a = "start") => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${sz}" font-weight="${w}" fill="${col}" font-family="Space Grotesk" text-anchor="${a}">${esc(s)}</text>`;
  let g = "";
  (sp.refs || []).forEach((r) => {
    if (r.to != null) { const ya = py(r.at), yb = py(r.to); g += `<rect x="${X + m.l}" y="${Math.min(ya, yb).toFixed(1)}" width="${(W - m.l - m.r).toFixed(1)}" height="${Math.abs(ya - yb).toFixed(1)}" fill="rgba(47,111,107,.09)"/>`; }
    else { const yr = py(r.at); g += `<line x1="${X + m.l}" y1="${yr.toFixed(1)}" x2="${(X + W - m.r).toFixed(1)}" y2="${yr.toFixed(1)}" stroke="${C.muted}" stroke-dasharray="4 4" stroke-width="1.2" opacity=".6"/>`; }
  });
  g += `<line x1="${X + m.l}" y1="${Y + m.t}" x2="${X + m.l}" y2="${Y + H - m.b}" stroke="#cfc7b6" stroke-width="1.2"/>`;
  g += `<line x1="${X + m.l}" y1="${Y + H - m.b}" x2="${px(xMax).toFixed(1)}" y2="${Y + H - m.b}" stroke="#cfc7b6" stroke-width="1.2"/>`;
  g += T(X + m.l - 8, Y + m.t + 6, sp.fmt(hi), 17, C.muted, 400, "end");
  g += T(X + m.l - 8, Y + H - m.b + 5, sp.fmt(lo), 17, C.muted, 400, "end");
  rows.forEach((r, i) => { if (i % 3 === 0 || i === rows.length - 1) g += T(px(r.year), Y + H - 7, "'" + String(r.year).slice(2), 16, C.muted, 400, "middle"); });
  const ends = [];
  sp.series.forEach((s) => {
    const pts = rows.map((r) => ({ yr: r.year, v: r[s.key] })).filter((p) => p.v != null);
    if (!pts.length) return;
    const path = pts.map((p, i) => `${i ? "L" : "M"}${px(p.yr).toFixed(1)},${py(p.v).toFixed(1)}`).join("");
    g += `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="${s.color === C.red ? 4 : 3}" stroke-linejoin="round" stroke-linecap="round"/>`;
    const e = pts[pts.length - 1];
    g += `<circle cx="${px(e.yr).toFixed(1)}" cy="${py(e.v).toFixed(1)}" r="6" fill="${s.color}"/>`;
    ends.push({ y: py(e.v), color: s.color, label: s.label, val: sp.fmt(e.v) });
  });
  ends.sort((a, b) => a.y - b.y);
  let prev = -1e9;
  ends.forEach((e) => { let ly = e.y; if (ly - prev < 40) ly = prev + 40; prev = ly; g += T(px(xMax) + 12, ly - 2, e.val, 22, e.color, 700); g += T(px(xMax) + 12, ly + 18, e.label, 15, C.muted); });
  return g;
}

function cardSVG(sp) {
  const W = 1200, Hh = 630;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">
    <rect width="${W}" height="${Hh}" fill="${C.paper}"/>
    <text x="64" y="66" font-size="22" font-weight="700" letter-spacing="5" fill="${C.red}" font-family="Space Grotesk">NADI DEMOKRASI</text>
    <text x="64" y="126" font-size="52" font-weight="700" fill="${C.ink}" font-family="Space Grotesk">${esc(sp.title)}</text>
    <text x="64" y="196" font-size="60" font-weight="700" fill="${C.ink}" font-family="Space Grotesk">${esc(sp.now)}</text>
    <text x="64" y="232" font-size="23" fill="${C.muted}" font-family="Space Grotesk">${esc(sp.cap)}</text>
    ${chartSVG(sp, 44, 262, 1092, 300)}
    <text x="64" y="600" font-size="19" fill="${C.muted}" font-family="Space Grotesk">Data: Malaysian Election Corpus (Thevesh) · zachtheyek.github.io/nadi-demokrasi</text>
  </svg>`;
}

const fontBuffers = [400, 500, 700].map((w) => readFileSync(`node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-${w}-normal.woff`));
mkdirSync("dist/og/s", { recursive: true });
const base = "https://zachtheyek.github.io/nadi-demokrasi";
for (const sp of specs) {
  const png = new Resvg(cardSVG(sp), { font: { fontBuffers, defaultFontFamily: "Space Grotesk", loadSystemFonts: false }, fitTo: { mode: "width", value: 1200 } }).render().asPng();
  writeFileSync(`dist/og/s/${sp.id}.png`, png);
  const title = `${sp.title} — Nadi Demokrasi`;
  mkdirSync(`dist/s/${sp.id}`, { recursive: true });
  writeFileSync(`dist/s/${sp.id}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(sp.summary)}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(sp.summary)}"/>
<meta property="og:image" content="${base}/og/s/${sp.id}.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="canonical" href="${base}/#${sp.id}"/>
<meta http-equiv="refresh" content="0; url=../../#${sp.id}"/>
</head><body style="font-family:sans-serif;padding:40px">Redirecting to <a href="../../#${sp.id}">${esc(sp.title)}</a>…</body></html>`);
}
console.log(`prerendered ${specs.length} section share cards`);
