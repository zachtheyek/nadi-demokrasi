// Per-section share cards. Each card is a 1200×630 OG image that reproduces the website section as a
// reader sees it: the section heading + question, the headline number + its caption, and the chart
// itself — WITH every annotation (reference bands, callouts, event lines, the winner's-bonus gap…).
// The chart is drawn by the SAME engine the page uses (src/chartkit.mjs), so a shared-on-X card is,
// in effect, a clean screenshot of the section. A tiny prerendered /s/<id>/ page carries the OG meta.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { buildSpecs, chartSVG, C } from "../src/chartkit.mjs";

const rows = JSON.parse(readFileSync("public/data/indicators.json", "utf8")).rows;
const specs = buildSpecs(rows);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const base = "https://zachtheyek.github.io/nadi-demokrasi";

// greedy word-wrap to a max character count per line (approximate; good enough for a caption)
function wrap(text, maxChars, maxLines = 3) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const cand = line ? line + " " + w : w;
    if (cand.length > maxChars && line) { lines.push(line); line = w; }
    else line = cand;
    if (lines.length === maxLines - 1 && line.length > maxChars) break;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function card(sp) {
  const W = 1200, H = 630;
  // draw the chart small (website-scale fonts) then scale the whole group up so it reads crisply on
  // the card — identical geometry + annotations to the page, just zoomed
  const Wc = 820, Hc = 293, sc = 1.33, ox = 56, oy = 210;
  const { g } = chartSVG(rows, sp.opts, Wc, Hc);
  const numW = sp.now.length * 30 + 8;                 // rough width of the big headline number
  const capX = ox + numW + 20;
  const capLines = wrap(sp.nowCap, Math.max(30, Math.floor((W - 54 - capX) / 9.6)), 3);
  const capStartY = 168 - (capLines.length - 1) * 11;  // keep the caption block centred on the number
  const T = (x, y, s, sz, col, w = 400, extra = "") => `<text x="${x}" y="${y}" font-size="${sz}" font-weight="${w}" fill="${col}" font-family="Space Grotesk" ${extra}>${esc(s)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${C.paper}"/>
    ${T(ox, 50, "NADI DEMOKRASI · THE PULSE OF DEMOCRACY", 20, C.red, 700, 'letter-spacing="4"')}
    ${T(ox, 98, sp.h2, 44, C.ink, 700)}
    ${T(ox, 132, sp.q, 22, C.teal, 400, 'font-style="italic"')}
    ${T(ox, 196, sp.now, 56, C.ink, 700)}
    ${capLines.map((l, i) => T(capX, capStartY + i * 23, l, 20, C.muted)).join("")}
    <g transform="translate(${ox},${oy}) scale(${sc})">${g}</g>
    ${T(ox, 616, "Data: Malaysian Election Corpus (Thevesh) · zachtheyek.github.io/nadi-demokrasi", 19, C.muted)}
  </svg>`;
}

const fontBuffers = [400, 500, 700].map((w) => readFileSync(`node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-${w}-normal.woff`));
mkdirSync("dist/og/s", { recursive: true });
for (const sp of specs) {
  const png = new Resvg(card(sp), { font: { fontBuffers, defaultFontFamily: "Space Grotesk", loadSystemFonts: false }, fitTo: { mode: "width", value: 1200 } }).render().asPng();
  writeFileSync(`dist/og/s/${sp.id}.png`, png);
  // the tweet leads with the section's question, then its summary — matching what the page shares
  const summary = `${sp.q} ${sp.share}`;
  const title = `${sp.h2} — Nadi Demokrasi`;
  mkdirSync(`dist/s/${sp.id}`, { recursive: true });
  writeFileSync(`dist/s/${sp.id}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(summary)}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(summary)}"/>
<meta property="og:image" content="${base}/og/s/${sp.id}.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="canonical" href="${base}/#${sp.id}"/>
<meta http-equiv="refresh" content="0; url=../../#${sp.id}"/>
</head><body style="font-family:sans-serif;padding:40px">Redirecting to <a href="../../#${sp.id}">${esc(sp.h2)}</a>…</body></html>`);
}
console.log(`prerendered ${specs.length} section share cards`);
