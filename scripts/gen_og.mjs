// Default OG card summarising the headline indicators.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";

const fontDir = "node_modules/@fontsource/space-grotesk/files";
const fonts = [
  { name: "Space Grotesk", weight: 400, style: "normal", data: readFileSync(join(fontDir, "space-grotesk-latin-400-normal.woff")) },
  { name: "Space Grotesk", weight: 700, style: "normal", data: readFileSync(join(fontDir, "space-grotesk-latin-700-normal.woff")) },
];
const rows = JSON.parse(readFileSync("public/data/indicators.json", "utf8")).rows;
const first = rows[0], last = rows[rows.length - 1];
const stat = (a, b, l) => `<div style="display:flex;flex-direction:column;margin-right:64px">
  <div style="display:flex;align-items:baseline"><div style="display:flex;font-size:62px;font-weight:700;color:#16130f">${a}</div><div style="display:flex;font-size:26px;color:#6b6256;margin-left:8px">→ ${b}</div></div>
  <div style="display:flex;font-size:22px;color:#6b6256;margin-top:4px">${l}</div></div>`;

const card = html(`
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;padding:64px 70px;background:#fbfaf6;font-family:'Space Grotesk'">
    <div style="display:flex;font-size:24px;font-weight:700;letter-spacing:5px;color:#b3402f">NADI DEMOKRASI · THE PULSE OF DEMOCRACY</div>
    <div style="display:flex;flex-direction:column;font-size:76px;font-weight:700;color:#16130f;line-height:1.02;margin-top:22px;letter-spacing:-1px">
      <div style="display:flex">Malaysia's democracy,</div>
      <div style="display:flex">in numbers.</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;margin-top:44px">
      ${stat(first.gallagher.toFixed(0), last.gallagher.toFixed(0), "disproportionality, 1955→2022")}
      ${stat(first.enp_seats.toFixed(1), last.enp_seats.toFixed(1), "effective parties")}
      ${stat(first.winner_vote_pc.toFixed(0) + "%", last.winner_vote_pc.toFixed(0) + "%", "winner's vote share")}
    </div>
    <div style="display:flex;margin-top:auto;font-size:23px;color:#6b6256">16 general elections · reproducible · Data: Malaysian Election Corpus (Thevesh)</div>
  </div>`);
writeFileSync("dist/og-default.png", new Resvg(await satori(card, { width: 1200, height: 630, fonts }), { fitTo: { mode: "width", value: 1200 } }).render().asPng());
console.log("generated default OG card");
