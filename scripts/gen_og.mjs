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
// Space Grotesk for the sans UI; Gelasio (a metric-compatible Georgia) for the serif tagline, to
// match the page's hero (which sets the deck in Georgia)
const T = (x, y, s, sz, col, w = 400, extra = "", ff = "Space Grotesk") => `<text x="${x}" y="${y}" font-size="${sz}" font-weight="${w}" fill="${col}" font-family="${ff}" ${extra}>${esc(s)}</text>`;

// one indicator tile: label, latest value, and a sparkline (nothing listed below it)
function tile(x, y, w, t) {
  const pts = rows.map((r) => r[t.key]).filter((v) => v != null);
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const sTop = y + 80, sH = 122;
  const px = (i) => x + i * (w / (pts.length - 1));
  const py = (v) => sTop + sH - (v - lo) / span * sH;
  const path = pts.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join("");
  const ex = px(pts.length - 1), ey = py(pts[pts.length - 1]);
  return `
    ${T(x, y + 22, t.label, 20, C.muted, 600)}
    ${T(x, y + 62, t.fmt(L[t.key]), 44, C.ink, 700)}
    <path d="${path}" fill="none" stroke="${C.red}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="4.5" fill="${C.red}"/>`;
}

const d0 = (v) => num(v, 0), d1 = (v) => num(v, 1), pct0 = (v) => num(v, 0) + "%", pct1 = (v) => num(v, 1) + "%";
const tiles = [
  { label: "Disproportionality", key: "gallagher", fmt: d1 },
  { label: "Malapportionment", key: "malapportionment", fmt: pct1 },
  { label: "Volatility", key: "volatility", fmt: d0 },
  { label: "Turnout", key: "turnout", fmt: pct0 },
];
const ox = 64, tw = 250, gap = 22, ty = 320;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${C.paper}"/>
  ${T(ox, 70, "NADI DEMOKRASI · THE PULSE OF DEMOCRACY", 22, C.red, 700, 'letter-spacing="5"')}
  ${T(ox, 150, "Malaysia's democracy, in numbers.", 62, C.ink, 700, 'letter-spacing="-1"')}
  ${T(ox, 210, "Seven decades of general elections, measured — fourteen political-science indicators", 25, C.muted, 400, "", "Gelasio")}
  ${T(ox, 244, "across sixteen elections, every formula listed and every number reproducible.", 25, C.muted, 400, "", "Gelasio")}
  ${tiles.map((t, i) => tile(ox + i * (tw + gap), ty, tw, t)).join("")}
  ${T(ox, 600, `${rows.length} general elections · ${F.year}–${L.year} · Data: Malaysian Election Corpus (Thevesh)`, 21, C.muted)}
</svg>`;

const fontBuffers = [
  ...[400, 500, 700].map((w) => readFileSync(`node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-${w}-normal.woff`)),
  readFileSync("node_modules/@fontsource/gelasio/files/gelasio-latin-400-normal.woff"),
];
writeFileSync("dist/og-default.png", new Resvg(svg, { font: { fontBuffers, defaultFontFamily: "Space Grotesk", loadSystemFonts: false }, fitTo: { mode: "width", value: 1200 } }).render().asPng());
console.log("generated default OG card");
