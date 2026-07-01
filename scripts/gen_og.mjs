// Default OG card for the whole page — the graphic that renders when the site link is shared. A
// compact "dashboard": the title, a one-line hook, and four headline indicators each drawn as a
// sparkline with its first→latest values, so the share itself previews what the page measures.
// Built as raw SVG + resvg (same engine and palette as the section cards) for a crisp, on-brand card.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { C } from "../src/chartkit.mjs";

const rows = JSON.parse(readFileSync("public/data/indicators.json", "utf8")).rows;
const F = rows[0], L = rows[rows.length - 1];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (v, d = 0) => Number(v).toFixed(d);
const T = (x, y, s, sz, col, w = 400, extra = "") => `<text x="${x}" y="${y}" font-size="${sz}" font-weight="${w}" fill="${col}" font-family="Space Grotesk" ${extra}>${esc(s)}</text>`;

// one indicator tile: label, latest value, a sparkline, and the first→latest movement
function tile(x, y, w, h, t) {
  const pts = rows.map((r) => r[t.key]).filter((v) => v != null);
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const sx = 0, sw = w, sTop = y + 66, sH = 58;
  const px = (i) => x + sx + i * (sw / (pts.length - 1));
  const py = (v) => sTop + sH - (v - lo) / span * sH;
  const path = pts.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join("");
  const ex = px(pts.length - 1), ey = py(pts[pts.length - 1]);
  return `
    ${T(x, y + 20, t.label, 20, C.muted, 600)}
    ${T(x, y + 54, t.fmt(L[t.key]), 40, C.ink, 700)}
    <path d="${path}" fill="none" stroke="${C.red}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="4" fill="${C.red}"/>
    ${T(x, y + 148, `${t.fmt(F[t.key])} → ${t.fmt(L[t.key])}  ·  ${F.year}–${L.year}`, 17, C.muted)}`;
}

const d1 = (v) => num(v, 1);
const pp = (v) => (v >= 0 ? "+" : "") + num(v, 1);
const pct1 = (v) => num(v, 1) + "%";
const tiles = [
  { label: "Disproportionality", key: "gallagher", fmt: d1 },
  { label: "Winner's bonus", key: "winner_seat_bonus", fmt: pp },
  { label: "Effective parties", key: "enp_seats", fmt: d1 },
  { label: "Malapportionment", key: "malapportionment", fmt: pct1 },
];
const ox = 64, tw = 250, gap = 22, ty = 316;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${C.paper}"/>
  ${T(ox, 70, "NADI DEMOKRASI · THE PULSE OF DEMOCRACY", 22, C.red, 700, 'letter-spacing="5"')}
  ${T(ox, 150, "Malaysia's democracy, in numbers.", 62, C.ink, 700, 'letter-spacing="-1"')}
  ${T(ox, 210, "Seven decades of general elections, measured — twelve political-science indicators", 25, C.muted)}
  ${T(ox, 244, "across sixteen elections, every formula open and every number reproducible.", 25, C.muted)}
  ${tiles.map((t, i) => tile(ox + i * (tw + gap), ty, tw, 170, t)).join("")}
  ${T(ox, 600, "16 general elections · 1955–2022 · Data: Malaysian Election Corpus (Thevesh)", 21, C.muted)}
</svg>`;

const fontBuffers = [400, 500, 700].map((w) => readFileSync(`node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-${w}-normal.woff`));
writeFileSync("dist/og-default.png", new Resvg(svg, { font: { fontBuffers, defaultFontFamily: "Space Grotesk", loadSystemFonts: false }, fitTo: { mode: "width", value: 1200 } }).render().asPng());
console.log("generated default OG card");
