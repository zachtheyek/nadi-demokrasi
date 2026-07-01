import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "katex/dist/katex.min.css";
import katex from "katex";
import "./style.css";

const BASE = import.meta.env.BASE_URL;
const SITE = location.origin + BASE;
const ORCID = "0000-0002-2532-4883";
// the X (formerly Twitter) wordmark, used in place of the letter "X" on share buttons
const X_ICON = `<svg class="xlogo" viewBox="0 0 24 24" aria-label="X" role="img"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
const GH_ICON = `<svg class="ghlogo" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
const app = document.getElementById("app")!;

interface Bloc { label: string; seats: number; seat_pc: number; }
interface Row {
  election: string; year: number; n_seats: number; n_blocs: number;
  enp_votes: number; enp_seats: number; gallagher: number; malapportionment: number | null;
  volatility: number | null; turnout: number | null;
  women_pc: number; cand_per_seat: number; three_plus_pc: number; marginal_pc: number;
  winner: string; winner_vote_pc: number; winner_seat_pc: number; winner_seat_bonus: number;
  top_blocs: Bloc[];
}
let ROWS: Row[] = [];

// palette (light theme) — clay red is the single accent; teal & gold are muted context hues
const C = { red: "#b3402f", teal: "#2f6f6b", gold: "#c08a2d", ink: "#16130f", muted: "#6b6256" };

/* ---------- data-driven helpers (nothing about the numbers is hard-coded) ---------- */
const last = () => ROWS[ROWS.length - 1];
const first = () => ROWS[0];
const at = (year: number) => ROWS.find((r) => r.year === year);
function arg(key: keyof Row, dir: 1 | -1) {
  let best: Row | null = null;
  for (const r of ROWS) {
    const v = r[key] as number | null;
    if (v == null) continue;
    if (!best || (dir > 0 ? v > (best[key] as number) : v < (best[key] as number))) best = r;
  }
  return best!;
}
const num = (v: number, d = 0) => v.toFixed(d);
const yy = (year: number) => "'" + String(year).slice(2);   // '04, '22 — never confused with an axis value

/* ---------- shared tooltip ---------- */
const tip = document.createElement("div");
tip.className = "tooltip";
document.body.appendChild(tip);
function showTip(html: string, x: number, y: number) { tip.innerHTML = html; tip.style.opacity = "1"; tip.style.left = Math.min(x + 12, innerWidth - 230) + "px"; tip.style.top = (y - 10) + "px"; }
function hideTip() { tip.style.opacity = "0"; }

/* ---------- toast (copy feedback) ---------- */
const toast = document.createElement("div");
toast.className = "toast";
document.body.appendChild(toast);
let toastT: any;
function showToast(msg: string) { toast.textContent = msg; toast.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove("on"), 1900); }

/* ---------- Tufte line chart ----------
   No gridlines. Range-frame axes. Direct end-labels (series name) instead of a legend, a single
   accent on the focal series, and a marker layer that makes each plot stand on its own: labelled
   point callouts for peaks/dips (with the value and an apostrophe-year), horizontal reference
   lines/bands for meaningful thresholds, and faint shaded regions for named periods. */
interface Series { label: string; color: string; focal?: boolean; y: (r: Row) => number | null; }
interface PointC { year: number; value: number; tag: string; place?: "above" | "below" | "left" | "right"; }
interface YRef { at: number; to?: number; label: string; side?: "left" | "right"; }
interface XBand { from: number; to: number; label?: string; }
interface XLine { year: number; label: string; }
interface GapC { year: number; label: string; }
interface ChartOpts {
  series: Series[];
  yMin?: number; yMax?: number; yLabel: string;
  fmt: (v: number) => string; unit?: string;
  points?: PointC[]; yRefs?: YRef[]; xBands?: XBand[]; xLines?: XLine[];
  gapFill?: boolean; gap?: GapC;
}

function renderChart(host: HTMLElement, o: ChartOpts) {
  const W = Math.max(300, host.clientWidth);
  const H = Math.min(310, Math.max(240, W * 0.56));
  const m = { t: 28, r: 96, b: 28, l: 38 };
  const years = ROWS.map((r) => r.year);
  const xMin = Math.min(...years), xMax = Math.max(...years);
  const all = o.series.flatMap((s) => ROWS.map(s.y).filter((v): v is number => v != null));
  const refVals = (o.yRefs || []).flatMap((r) => (r.to != null ? [r.at, r.to] : [r.at]));
  const pool = all.concat(refVals);
  const hi = o.yMax ?? Math.max(...pool) * 1.16;   // headroom so a top peak's label sits above it
  const lo = o.yMin ?? Math.min(0, Math.min(...pool));
  const plotTop = m.t, plotBot = H - m.b, plotRight = W - m.r;
  const x = (yr: number) => m.l + (yr - xMin) / (xMax - xMin) * (plotRight - m.l);
  const y = (v: number) => plotBot - (v - lo) / (hi - lo) * (plotBot - plotTop);
  const clampY = (v: number) => Math.max(plotTop + 8, Math.min(plotBot - 4, v));

  let g = "";
  // every text label registers its box here so callouts can be placed clear of all of them
  type Box = { x0: number; x1: number; y0: number; y1: number };
  const placed: Box[] = [];
  const fits = (b: Box) => !placed.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);
  const reserveL = (cx: number, w: number, cy: number, anchor: "start" | "middle" | "end") => {
    const x0 = anchor === "end" ? cx - w : anchor === "middle" ? cx - w / 2 : cx;
    placed.push({ x0, x1: x0 + w, y0: cy - 10, y1: cy + 3 });
  };

  // shaded period bands (faintest layer)
  (o.xBands || []).forEach((b) => {
    const x0 = x(Math.max(b.from, xMin)), x1 = x(Math.min(b.to, xMax));
    g += `<rect class="xband" x="${x0.toFixed(1)}" y="${plotTop}" width="${(x1 - x0).toFixed(1)}" height="${(plotBot - plotTop).toFixed(1)}"/>`;
    if (b.label) { const lx = (x0 + x1) / 2, ly = plotTop - 8; g += `<text class="bandlab" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${b.label}</text>`; reserveL(lx, b.label.length * 5.9, ly, "middle"); }
  });

  // horizontal reference lines / bands — line labels sit BELOW the line, left by default (right on request)
  (o.yRefs || []).forEach((r) => {
    const right = r.side === "right";
    const lx = right ? plotRight - 4 : m.l + 5, anchor = right ? "end" : "start";
    if (r.to != null) {
      const ya = y(r.at), yb = y(r.to);
      g += `<rect class="yband" x="${m.l}" y="${Math.min(ya, yb).toFixed(1)}" width="${(plotRight - m.l).toFixed(1)}" height="${Math.abs(ya - yb).toFixed(1)}"/>`;
      const ly = (ya + yb) / 2 + 3;
      g += `<text class="reflab" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${r.label}</text>`;
      reserveL(lx, r.label.length * 5.3, ly, anchor);
    } else {
      const yr = y(r.at), ly = yr + 14;
      g += `<line class="refline" x1="${m.l}" y1="${yr.toFixed(1)}" x2="${plotRight.toFixed(1)}" y2="${yr.toFixed(1)}"/>`;
      g += `<text class="reflab" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${r.label}</text>`;
      reserveL(lx, r.label.length * 5.3, ly, anchor);
    }
  });

  // vertical reference lines (e.g. a named event year) — dashed, label at the top
  (o.xLines || []).forEach((xl) => {
    const vx = x(xl.year);
    g += `<line class="xline" x1="${vx.toFixed(1)}" y1="${(plotTop + 4).toFixed(1)}" x2="${vx.toFixed(1)}" y2="${plotBot.toFixed(1)}"/>`;
    g += `<text class="xlinelab" x="${vx.toFixed(1)}" y="${(plotTop - 2).toFixed(1)}" text-anchor="middle">${xl.label}</text>`;
    reserveL(vx, xl.label.length * 5.5, plotTop - 2, "middle");
  });

  // range-frame axes (thin, only where data lives) + min/max y ticks
  g += `<line class="frame" x1="${m.l}" y1="${plotTop}" x2="${m.l}" y2="${plotBot}"/>`;
  g += `<line class="frame" x1="${m.l}" y1="${plotBot}" x2="${plotRight.toFixed(1)}" y2="${plotBot}"/>`;
  g += `<text class="axt" x="${m.l - 6}" y="${(plotTop + 4).toFixed(1)}" text-anchor="end">${o.fmt(hi)}</text>`;
  g += `<text class="axt" x="${m.l - 6}" y="${(plotBot + 3).toFixed(1)}" text-anchor="end">${o.fmt(lo)}</text>`;

  // x year labels (every other election, always the last), apostrophe-prefixed so they read as years
  ROWS.forEach((r, i) => { if (i % 2 === 0 || i === ROWS.length - 1) g += `<text class="axt" x="${x(r.year).toFixed(1)}" y="${H - 8}" text-anchor="middle">${yy(r.year)}</text>`; });

  // gap fill between two series (shows the seat bonus / squeeze directly)
  if (o.gapFill && o.series.length === 2) {
    const pa = ROWS.map((r) => ({ yr: r.year, v: o.series[0].y(r) })).filter((p) => p.v != null) as { yr: number; v: number }[];
    const pb = ROWS.map((r) => ({ yr: r.year, v: o.series[1].y(r) })).filter((p) => p.v != null) as { yr: number; v: number }[];
    if (pa.length && pa.length === pb.length) {
      const top = pa.map((p) => `${x(p.yr).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
      const bot = pb.slice().reverse().map((p) => `${x(p.yr).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
      g += `<polygon class="gapfill" points="${top} ${bot}"/>`;
    }
  }

  // series lines + hover targets; collect end points for de-collided name labels
  const ends: { yPt: number; color: string; label: string }[] = [];
  o.series.forEach((s) => {
    const pts = ROWS.map((r) => ({ r, v: s.y(r) })).filter((p) => p.v != null) as { r: Row; v: number }[];
    if (!pts.length) return;
    const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.r.year).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    g += `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="${s.focal ? 2.6 : 1.8}" stroke-linejoin="round" stroke-linecap="round"/>`;
    g += pts.map((p) => `<circle class="dot" cx="${x(p.r.year).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="9" fill="transparent" data-y="${p.r.year}" data-v="${p.v}" data-l="${s.label}" data-w="${p.r.winner}"/>`).join("");
    const e = pts[pts.length - 1];
    g += `<circle cx="${x(e.r.year).toFixed(1)}" cy="${y(e.v).toFixed(1)}" r="${s.focal ? 3.4 : 3}" fill="${s.color}"/>`;
    ends.push({ yPt: y(e.v), color: s.color, label: s.label });
  });
  // push overlapping end-labels apart (two-series charts end very close together)
  ends.sort((a, b) => a.yPt - b.yPt);
  let prev = -1e9;
  ends.forEach((e) => {
    let ly = clampY(e.yPt); if (ly - prev < 14) ly = prev + 14; prev = ly;
    if (Math.abs(ly - e.yPt) > 2) g += `<line class="leader" x1="${(plotRight + 3).toFixed(1)}" y1="${e.yPt.toFixed(1)}" x2="${(plotRight + 7).toFixed(1)}" y2="${ly.toFixed(1)}"/>`;
    g += `<text class="endname" x="${(plotRight + 9).toFixed(1)}" y="${(ly + 3.5).toFixed(1)}" fill="${e.color}">${e.label}</text>`;
    reserveL(plotRight + 9, e.label.length * 6.2, ly + 3.5, "start");
  });

  // gap connector between two series at a given year (e.g. the peak seat bonus) — two-line tag
  // ("+27.2pp bonus" over the year) sitting well above the top line
  if (o.gap && o.series.length === 2) {
    const r = at(o.gap.year); if (r) {
      const va = o.series[0].y(r)!, vb = o.series[1].y(r)!;
      const gx = x(o.gap.year), ya = y(va), yb = y(vb);
      g += `<line class="gapconn" x1="${gx.toFixed(1)}" y1="${ya.toFixed(1)}" x2="${gx.toFixed(1)}" y2="${yb.toFixed(1)}"/>`;
      const gw = Math.max(o.gap.label.length, 4) * 6.4;
      let ty = clampY(Math.min(ya, yb) - 24);   // headroom for a two-line label above the top line
      for (let k = 0; k < 5; k++) { if (fits({ x0: gx - gw / 2, x1: gx + gw / 2, y0: ty - 10, y1: ty + 15 })) break; ty = clampY(ty - 12); }
      g += `<text class="gaptag" x="${(gx).toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle">${o.gap.label}</text>`;
      g += `<text class="ctag" x="${(gx).toFixed(1)}" y="${(ty + 12).toFixed(1)}" text-anchor="middle">${yy(o.gap.year)}</text>`;
      reserveL(gx, gw, ty, "middle");
      reserveL(gx, gw, ty + 12, "middle");
    }
  }

  // labelled point callouts (peaks / dips / notable) — the values that make the plot standalone
  (o.points || []).forEach((p) => {
    const s = o.series.find((ss) => ss.y(at(p.year)!) != null) || o.series[0];
    const cx = x(p.year), cy = y(p.value);
    const tag = p.tag ? `${yy(p.year)} (${p.tag})` : yy(p.year);
    const w = Math.max(o.fmt(p.value).length * 6.4, tag.length * 5.7);
    const drawDot = () => `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="${s.color}"/>`;
    const drawText = (tx: number, vY: number, sY: number, anchor: string) =>
      `<text class="cval" x="${tx.toFixed(1)}" y="${vY.toFixed(1)}" text-anchor="${anchor}" fill="${s.color}">${o.fmt(p.value)}</text>` +
      `<text class="ctag" x="${tx.toFixed(1)}" y="${sY.toFixed(1)}" text-anchor="${anchor}">${tag}</text>`;

    if (p.place === "left" || p.place === "right") {
      // beside the point, at its height (keeps dips off the line)
      const dir = p.place === "left" ? -1 : 1;
      const anchor = p.place === "left" ? "end" : "start";
      const tx = cx + dir * 9;
      let vY = cy - 3, sY = cy + 9;
      const x0 = p.place === "left" ? tx - w : tx, x1 = p.place === "left" ? tx : tx + w;
      for (let k = 0; k < 8; k++) { if (fits({ x0, x1, y0: vY - 10, y1: sY + 3 })) break; vY += 13; sY += 13; }
      vY = clampY(vY); sY = vY + 12;
      placed.push({ x0, x1, y0: vY - 10, y1: sY + 3 });
      g += drawDot();
      g += `<line class="leader" x1="${(cx + dir * 5).toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(tx - dir * 2).toFixed(1)}" y2="${((vY + sY) / 2).toFixed(1)}"/>`;
      g += drawText(tx, vY, sY, anchor);
      return;
    }

    // above / below, with the label pushed to the correct side of edge points
    const atRight = p.year === xMax, atLeft = p.year === xMin;
    const anchor = atRight ? "end" : atLeft ? "start" : "middle";
    const tx = atRight ? cx - 7 : atLeft ? cx + 7 : cx;
    const x0 = atRight ? tx - w : atLeft ? tx : tx - w / 2, x1 = atRight ? tx : atLeft ? tx + w : tx + w / 2;
    let place = p.place || "above";
    if (place === "above" && cy - 30 < plotTop) place = "below";
    if (place === "below" && cy + 30 > plotBot) place = "above";
    let vY = place === "above" ? cy - 26 : cy + 15;
    for (let k = 0; k < 8; k++) { if (fits({ x0, x1, y0: vY - 11, y1: vY + 13 })) break; vY += place === "above" ? -13 : 13; }
    vY = clampY(vY);
    const sY = vY + 12;
    placed.push({ x0, x1, y0: vY - 11, y1: sY + 3 });
    g += drawDot();
    g += `<line class="leader" x1="${cx.toFixed(1)}" y1="${(cy + (place === "above" ? -5 : 5)).toFixed(1)}" x2="${tx.toFixed(1)}" y2="${(place === "above" ? sY + 2 : vY - 10).toFixed(1)}"/>`;
    g += drawText(tx, vY, sY, anchor);
  });

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${o.yLabel}">${g}<g class="hoverdots"></g></svg>`;
  const hg = host.querySelector(".hoverdots")!;
  // hovering any point highlights ALL series at that year (a dot on each) and shows one unified card
  const showAt = (year: number, cx: number, cy: number) => {
    const row = at(year); if (!row) return;
    let dots = "", items = "";
    o.series.forEach((s) => {
      const v = s.y(row); if (v == null) return;
      dots += `<circle class="hoverdot" cx="${x(year).toFixed(1)}" cy="${y(v).toFixed(1)}" r="5" fill="${s.color}"/>`;
      const lab = o.series.length > 1 ? `${year} ${s.label}` : `${year}`;
      items += `<div class="ttitem"><div class="ttlab">${lab}</div><div class="ttv" style="color:${s.color}">${o.fmt(v)}${o.unit || ""}</div></div>`;
    });
    hg.innerHTML = dots;
    showTip(`${items}<div class="ttwin">won by ${row.winner}</div>`, cx, cy);
  };
  const clear = () => { hg.innerHTML = ""; hideTip(); };
  host.querySelectorAll(".dot").forEach((d) => {
    const el = d as SVGElement;
    const move = (ev: any) => {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      showAt(+el.dataset.y!, cx, cy);
    };
    el.addEventListener("mouseenter", move);
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", clear);
    el.addEventListener("touchstart", move, { passive: true });
  });
}

/* ---------- method dropdown (LaTeX + plain English, hidden by default) ---------- */
interface Method { eq?: string; where?: string; text?: string; }
interface Sec { id: string; h2: string; q: string; now: string; nowCap: string; share: string; opts: ChartOpts; body: string; note?: string; method: Method; }

function sections(): Sec[] {
  const L = last(), F = first();

  const gPeak = arg("gallagher", 1);
  const mPeak = arg("malapportionment", 1), mLow = arg("malapportionment", -1);
  const bPeak = arg("winner_seat_bonus", 1);
  const minorityWins = ROWS.filter((r) => r.winner_vote_pc < 50 && r.winner_seat_pc > 50);
  const minRecent = minorityWins.length ? minorityWins[minorityWins.length - 1].year : null;
  // exemplar for the chart: the most recent clear case (seat majority ≥ 55% on a vote minority)
  const clearMin = minorityWins.filter((r) => r.winner_seat_pc >= 55);
  const minExemplar = (clearMin.length ? clearMin : minorityWins).slice(-1)[0];
  // derived seat-bonus wording (so it stays true when the latest election changes)
  const bNow = L.winner_seat_bonus;
  const bonusCap = bNow < -0.5 ? "the winner now takes a smaller share of seats than of votes, a reversal from years past."
    : Math.abs(bNow) <= 2 ? "the bonus has all but vanished." : bNow > 0 ? "the winner still gains from the system." : "the bonus has vanished.";
  const firstNeg = ROWS.filter((r) => r.winner_seat_bonus < 0)[0];
  const isFirstNeg = !!firstNeg && firstNeg.year === L.year;
  const hung = !L.top_blocs.some((b) => b.seat_pc > 50);
  const enpPeak = arg("enp_seats", 1), enpLow = arg("enp_seats", -1);
  const volRanked = ROWS.filter((r) => r.volatility != null).sort((a, b) => (b.volatility! - a.volatility!));
  const volTop = volRanked.slice(0, 3);
  const volDips = volRanked.slice(-2);   // the two calmest elections
  // short historical context for the notable spikes/calms (keyed by year → drift-safe: a future
  // election with no entry simply shows value + year, no context)
  const volContext: Record<number, string> = {
    1959: "opposition emerges", 1982: "BN unchallenged", 1990: "UMNO splits",
    1999: "Reformasi", 2008: "political tsunami", 2013: "BN–PR rematch",
  };
  const r2008 = at(2008);
  const tPeak = arg("turnout", 1), tLow = arg("turnout", -1);
  const tPrev = ROWS[ROWS.length - 2];
  const tDrop = (tPrev.turnout != null && L.turnout != null) ? (tPrev.turnout - L.turnout) : 0;
  // dominance: first election the winner's vote share dropped below half the vote
  const belowHalf = ROWS.find((r) => r.winner_vote_pc < 50);
  // "lost for good": the election after the LAST one where the winner held a two-thirds seat share
  let lastAbove = -1;
  ROWS.forEach((r, i) => { if (r.winner_seat_pc >= 200 / 3) lastAbove = i; });
  const twoThirdsYr = (lastAbove >= 0 && lastAbove < ROWS.length - 1) ? ROWS[lastAbove + 1].year : null;
  const big3 = L.top_blocs.slice(0, 3);
  // new indicators
  const candLow = arg("cand_per_seat", -1), candPeak = arg("cand_per_seat", 1);
  const margPeak = arg("marginal_pc", 1);
  const wPeak = arg("women_pc", 1);

  const hl = (s: string) => `<span class="hl">${s}</span>`;
  const hlt = (s: string) => `<span class="hl-t">${s}</span>`;
  const hlg = (s: string) => `<span class="hl-g">${s}</span>`;

  return [
    /* 1 ─ the total gap */
    {
      id: "disproportionality", h2: "Disproportionality", q: "How faithfully do votes turn into seats?",
      now: num(L.gallagher, 1),
      nowCap: `the gap between how Malaysians voted and the seats they got in ${L.year} — near its narrowest ever, down from a peak of ${num(gPeak.gallagher, 1)} in ${gPeak.year}.`,
      share: `Malaysia's vote-to-seat disproportionality (Gallagher) peaked at ${num(gPeak.gallagher, 1)} in ${gPeak.year} and has fallen to ${num(L.gallagher, 1)} by ${L.year}.`,
      opts: {
        series: [{ label: "Gallagher", color: C.red, focal: true, y: (r) => r.gallagher }],
        yLabel: "Gallagher disproportionality", fmt: (v) => num(v, 1), yMin: 0,
        yRefs: [{ at: 2, to: 5, label: "typical PR system" }, { at: 12, label: "high by world standards" }],
        points: [{ year: gPeak.year, value: gPeak.gallagher, tag: "peak" }, { year: L.year, value: L.gallagher, tag: "now", place: "below" }],
      },
      body: `The Gallagher index — a single measure of how far a parliament's seats stray from the votes cast — peaked at ${hl(num(gPeak.gallagher, 1) + " in " + gPeak.year)}, when the winning bloc (${gPeak.winner}) turned ${hlt(num(gPeak.winner_vote_pc) + "%")} of the vote into ${hlt(num(gPeak.winner_seat_pc) + "%")} of seats. By ${L.year} it had fallen to ${hl(num(L.gallagher, 1))} — the closest Malaysia's seats have come to matching its votes. A score above about 12 is high by world standards; established proportional systems sit near 2–5.`,
      note: `This is the <em>total</em> gap between votes and seats. It has two sources — an electoral system that rewards the largest bloc (see <a href="#seat-bonus">the winner's bonus</a>) and electoral districts drawn to hold very different numbers of voters, so a vote in one seat can weigh far more than a vote in another (<a href="#malapportionment">malapportionment</a>). The next two sections measure each in turn.`,
      method: {
        eq: String.raw`\mathrm{LSq} = \sqrt{\tfrac{1}{2} \textstyle\sum_i (v_i - s_i)^2}`,
        where: `<strong>v<sub>i</sub></strong> and <strong>s<sub>i</sub></strong> are bloc <em>i</em>'s share of the valid vote and of seats, in percentage points. A perfectly proportional result — every bloc's seat share equal to its vote share — scores 0; the bigger the score, the larger the gap between votes cast and seats won.`,
      },
    },
    /* 2 ─ one source: the winner's mechanical reward */
    {
      id: "seat-bonus", h2: "The winner's bonus", q: "How much does the system inflate the largest bloc?",
      now: (L.winner_seat_bonus >= 0 ? "+" : "") + num(L.winner_seat_bonus, 1),
      nowCap: `percentage-point gap between the winner's seat share and vote share in ${L.year} — ${bonusCap}`,
      share: `First-past-the-post once handed Malaysia's election winner up to +${num(bPeak.winner_seat_bonus, 1)} points of seat bonus (${bPeak.year}). By ${L.year} it had vanished (${num(L.winner_seat_bonus, 1)}).`,
      opts: {
        series: [
          { label: "Seat share", color: C.red, focal: true, y: (r) => r.winner_seat_pc },
          { label: "Vote share", color: C.teal, y: (r) => r.winner_vote_pc },
        ],
        yLabel: "Winner's seat share vs vote share", fmt: (v) => num(v) + "%", yMin: 0, yMax: 100,
        gapFill: true, gap: { year: bPeak.year, label: "+" + num(bPeak.winner_seat_bonus, 1) + "pp bonus" },
        points: minorityWins.map((r) => ({ year: r.year, value: r.winner_seat_pc, tag: "won on " + num(r.winner_vote_pc) + "%", place: "above" as const })),
      },
      body: `The gap between the winner's seats (red) and votes (teal) is the bonus first-past-the-post hands the largest bloc. It peaked at ${hlt("+" + num(bPeak.winner_seat_bonus, 1) + " points in " + bPeak.year)}, when ${bPeak.winner} turned ${hlt(num(bPeak.winner_vote_pc) + "%")} of votes into ${hl(num(bPeak.winner_seat_pc) + "%")} of seats.${minRecent ? ` On ${minorityWins.length === 1 ? "one occasion" : minorityWins.length + " occasions"} the largest bloc even won a majority of seats on a ${hlt("minority of the vote")} — most recently in ${minRecent}.` : ""} By ${L.year}, ${bNow < -0.5 ? `the gap has vanished (${hlt(num(bNow, 1))})` : Math.abs(bNow) <= 2 ? `the gap has all but vanished (${hlt(num(bNow, 1))})` : `the gap stands at ${hlt(num(bNow, 1))}`}${isFirstNeg ? `: for the first time, the largest bloc held a smaller share of seats than of votes` : ""}${hung ? `, in a hung parliament` : ""}.`,
      method: {
        eq: String.raw`B = s_w - v_w`,
        where: `<strong>s<sub>w</sub></strong> and <strong>v<sub>w</sub></strong> are the winning bloc's share of seats and of the valid vote (%). A positive <em>B</em> means the system magnified the leader into a bigger parliamentary presence than its votes alone would justify; a negative <em>B</em> means it under-rewarded them.`,
      },
    },
    /* 3 ─ the other source: unequal districts */
    {
      id: "malapportionment", h2: "Malapportionment", q: "Is every vote worth the same?",
      now: num(L.malapportionment ?? 0, 1) + "%",
      nowCap: `of seats are mis-allocated relative to one-person-one-vote in ${L.year} — a record, and extreme by world standards.`,
      share: `${num(L.malapportionment ?? 0, 1)}% of Malaysia's parliamentary seats are mis-allocated relative to one-person-one-vote (${L.year}) — among the most malapportioned democracies in the world.`,
      opts: {
        series: [{ label: "MAL", color: C.red, focal: true, y: (r) => r.malapportionment }],
        yLabel: "Malapportionment index", fmt: (v) => num(v, 1) + "%", yMin: 0,
        yRefs: [{ at: 0, to: 5, label: "most democracies ≤ 5%" }, { at: 15, label: "among the most malapportioned", side: "right" }],
        points: [{ year: mLow.year, value: mLow.malapportionment ?? 0, tag: "lowest", place: "below" }, { year: mPeak.year, value: mPeak.malapportionment ?? 0, tag: "peak" }],
      },
      body: `Every seat elects one MP, but seats hold wildly unequal numbers of voters — a rural seat can have a fraction of an urban one's electorate, so a rural vote counts for more. The Samuels–Snyder index gives the share of seats that would have to be reallocated to equalise voters per seat. Malaysia's has climbed to ${hl(num(mPeak.malapportionment ?? 0, 1) + "% in " + mPeak.year)}, from a low of ${hl(num(mLow.malapportionment ?? 0, 1) + "% in " + mLow.year)}. Anything above a few percent is high; ${hl("above ~15% is among the most malapportioned in the democratic world")}. This is a <em>structural</em> distortion, separate from <a href="#seat-bonus">the winner's bonus</a> — and unlike that bonus, it has not gone away.`,
      note: `Malapportionment — unequal district sizes — is one of two ways boundaries can distort an election; the other is <em>gerrymandering</em>, drawing the shapes to pack or split a party's voters, which this index does not measure. Both are baked into where the lines are drawn, so they persist across changes of government — a large part of why <a href="#disproportionality">disproportionality</a> stayed high even as <a href="#seat-bonus">the winner's bonus</a> collapsed.`,
      method: {
        eq: String.raw`\mathrm{MAL} = \tfrac{1}{2} \textstyle\sum_i \left\lvert \dfrac{1}{n} - \dfrac{e_i}{E} \right\rvert`,
        where: `<strong>n</strong> is the number of seats, <strong>e<sub>i</sub></strong> the registered electors in seat <em>i</em>, and <strong>E</strong> the total electorate. Each seat carries an equal 1 / n of the seats but an unequal e<sub>i</sub> / E of the voters; the index sums those gaps and halves them — the fraction of seats "in the wrong place" under one-person-one-vote.`,
      },
    },
    /* 4 ─ the winner's grip, over time */
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
          { year: F.year, value: F.winner_vote_pc, tag: "high", place: "right" as const },
          ...(belowHalf ? [{ year: belowHalf.year, value: belowHalf.winner_vote_pc, tag: "fell below half for the first time", place: "below" as const }] : []),
          { year: L.year, value: L.winner_vote_pc, tag: "low", place: "below" as const },
        ],
      },
      body: `The winning coalition's share of the popular vote has fallen from ${hl(num(F.winner_vote_pc) + "% in " + F.year)} to ${hl(num(L.winner_vote_pc) + "% in " + L.year)} — the lowest in our history.${twoThirdsYr ? ` The two-thirds parliamentary supermajority, long the benchmark of dominance, was lost for good in ${hlt(String(twoThirdsYr))}.` : ""} Malaysia has moved decisively from a dominant-party system to competitive, coalition-by-coalition politics.`,
      method: {
        text: `The "winner" is the bloc that took the most seats; the line is its share of all valid federal votes cast that year. Read it alongside <a href="#fragmentation">fragmentation</a> below: a falling winner's share and a rising effective number of parties are two views of the same shift to multi-bloc competition.`,
      },
    },
    /* 5 ─ how many blocs matter */
    {
      id: "fragmentation", h2: "Fragmentation", q: "How many parties really matter?",
      now: num(L.enp_seats, 1),
      nowCap: `effective number of parliamentary parties in ${L.year} — the most fragmented in our history.`,
      share: `Malaysia's effective number of parliamentary parties has risen from about ${num(enpLow.enp_seats, 1)} to a record ${num(L.enp_seats, 1)} (${L.year}) — from a one-party-dominant system to a genuine multi-bloc contest.`,
      opts: {
        series: [
          { label: "By seats", color: C.red, focal: true, y: (r) => r.enp_seats },
          { label: "By votes", color: C.gold, y: (r) => r.enp_votes },
        ],
        yLabel: "Effective number of parties", fmt: (v) => num(v, 1), yMin: 0.8,
        points: [{ year: enpLow.year, value: enpLow.enp_seats, tag: "one-party low", place: "below" }, { year: enpPeak.year, value: enpPeak.enp_seats, tag: "record" }],
      },
      body: `The effective number of parties weights each bloc by its size, so a few dominant blocs count for less than many even ones. Malaysia spent decades as a ${hlt("one-and-a-half-party system")} — about ${hlg(num(F.enp_votes, 1))} effective parties by votes in ${hlg(String(F.year))}, bottoming at ${hl(num(enpLow.enp_seats, 1))} in parliament in ${hl(String(enpLow.year))}. It has since climbed to ${hl(num(enpPeak.enp_seats, 1) + " by " + enpPeak.year)}, a genuine multi-way contest between its three biggest blocs — ${big3.map((b) => hlt(b.label)).join(", ").replace(/, ([^,]*)$/, " and $1")}. For decades the seats line sat below the votes line — first-past-the-post squeezing smaller blocs out of parliament — until ${enpPeak.year}, when a fragmented result closed the gap.`,
      method: {
        eq: String.raw`N = \dfrac{1}{\sum_i p_i^{\,2}}`,
        where: `<strong>p<sub>i</sub></strong> is bloc <em>i</em>'s share — of votes for the votes line, of seats for the seats line. Two equally-sized blocs give N = 2; one dominant bloc pulls N toward 1. It is the Laakso–Taagepera index, a standard count of "parties that matter".`,
      },
    },
    /* 6 ─ how many contenders per seat */
    {
      id: "multi-cornered", h2: "Multi-cornered contests", q: "How many names on the ballot?",
      now: num(L.cand_per_seat, 1),
      nowCap: `candidates on the average ballot in ${L.year} — ${num(L.three_plus_pc)}% of seats were three-cornered or more.`,
      share: `Malaysia's ballots have crowded: the average federal seat drew ${num(L.cand_per_seat, 1)} candidates in ${L.year} (up from about 2 in the two-coalition era), and ${num(L.three_plus_pc)}% of seats were three-cornered or more.`,
      opts: {
        series: [{ label: "Candidates", color: C.red, focal: true, y: (r) => r.cand_per_seat }],
        yLabel: "Candidates per seat", fmt: (v) => num(v, 1), yMin: 2,
        points: [{ year: candLow.year, value: candLow.cand_per_seat, tag: "fewest", place: "below" }, { year: candPeak.year, value: candPeak.cand_per_seat, tag: "peak" }],
      },
      body: `For most of Malaysia's history a seat was a straight fight — about ${hl(num(F.cand_per_seat, 1))} candidates on the ballot. As the two-coalition system hardened, contests narrowed to a low of ${hl(num(candLow.cand_per_seat, 1) + " in " + candLow.year)}. Then they splintered: by ${L.year} the average seat drew ${hl(num(L.cand_per_seat, 1) + " candidates")}, and ${hlt(num(L.three_plus_pc) + "% were three-cornered or more")}. Multi-cornered fights are how a bloc can win a seat on a minority of the vote — much of the machinery behind the <a href="#disproportionality">disproportionality</a> above.`,
      method: {
        eq: String.raw`\bar{c} = \dfrac{1}{n} \textstyle\sum_i c_i`,
        where: `<strong>c<sub>i</sub></strong> is the number of candidates contesting seat <em>i</em> and <strong>n</strong> the number of seats — so the figure is simply the <em>mean</em> candidates per seat. Read it with <a href="#fragmentation">fragmentation</a>: more blocs mean more names on the ballot and more three-way splits, which under first-past-the-post let winners take seats with well under half the vote.`,
      },
    },
    /* 7 ─ how much the vote moves */
    {
      id: "volatility", h2: "Volatility", q: "How much does the vote move between elections?",
      now: num(L.volatility ?? 0),
      nowCap: `how much the vote shifted between blocs from the previous election, in ${L.year} — one of the largest realignments on record.`,
      share: `Malaysia's biggest electoral realignments by vote-share (Pedersen volatility): ${volTop.map((r) => r.year).sort((a, b) => a - b).join(", ")}${L.volatility === volTop[0].volatility ? "" : `, with ${L.year} among them`}.`,
      opts: {
        series: [{ label: "Pedersen", color: C.teal, focal: true, y: (r) => r.volatility }],
        yLabel: "Electoral volatility", fmt: (v) => num(v), yMax: Math.max(...ROWS.map((r) => r.volatility ?? 0)) * 1.35,
        xLines: at(2008) ? [{ year: 2008, label: `${yy(2008)} ${volContext[2008]}` }] : [],
        points: [
          ...volTop.map((r) => ({ year: r.year, value: r.volatility!, tag: volContext[r.year] ?? "" })),
          // dips sit to the SIDES so they don't collide with the line at the bottom of the V
          ...volDips.slice().sort((a, b) => a.year - b.year).map((r, i) => ({ year: r.year, value: r.volatility!, tag: volContext[r.year] ?? "", place: (i === 0 ? "left" : "right") as const })),
        ],
      },
      body: `Pedersen volatility sums how much each bloc's vote share shifts from one election to the next. The largest realignments by this measure came in ${hlt(volTop.map((r) => r.year).sort((a, b) => a - b).join(", "))} — each a wholesale redrawing of who voted for whom. The calmest elections — ${volDips.slice().sort((a, b) => a.year - b.year).map((r) => hlt(String(r.year))).join(" and ")} — were near-repeat contests, where little support moved between blocs.`,
      note: r2008 ? `A caution on reading this chart: the ${r2008.year} "political tsunami" — when the ruling coalition lost its two-thirds majority — barely registers here (${hlt(num(r2008.volatility ?? 0))}). That shock was about <em>seats</em>, not vote share: BN still won ${hlt(num(r2008.winner_vote_pc) + "%")} of the vote, so relatively little support actually moved between blocs. Vote volatility and seat change can tell very different stories.` : undefined,
      method: {
        eq: String.raw`V = \tfrac{1}{2} \textstyle\sum_i \lvert v_{i,t} - v_{i,t-1} \rvert`,
        where: `<strong>v<sub>i,t</sub></strong> is bloc <em>i</em>'s vote share at election <em>t</em>. Blocs are matched across elections with pure renames collapsed (PERIKATAN→BN, BA→PR→PH), so relabelling is not counted as change — but genuine splits and mergers are. The first election has no prior to compare against, so its value is null.`,
      },
    },
    /* 8 ─ how close the contests are */
    {
      id: "marginal", h2: "Marginal seats", q: "How close are the contests?",
      now: num(L.marginal_pc, 1) + "%",
      nowCap: `of seats in ${L.year} were won by less than 5 points — about one in ${Math.round(100 / L.marginal_pc)} seats.`,
      share: `About one in ${Math.round(100 / L.marginal_pc)} Malaysian seats is now a knife-edge: ${num(L.marginal_pc, 1)}% were won by under 5 points in ${L.year}, far above the norm for most of the country's history.`,
      opts: {
        series: [{ label: "Marginal", color: C.red, focal: true, y: (r) => r.marginal_pc }],
        yLabel: "Share of marginal seats", fmt: (v) => num(v, 1) + "%", yMin: 0,
        points: [{ year: margPeak.year, value: margPeak.marginal_pc, tag: "peak" }, { year: L.year, value: L.marginal_pc, tag: "now", place: "below" }],
      },
      body: `A marginal seat — won by less than five percentage points — is where an election actually turns. Malaysia's map was long dominated by safe seats, but contestability has risen sharply: marginals peaked at ${hl(num(margPeak.marginal_pc, 1) + "% in " + margPeak.year)} and stood at ${hl(num(L.marginal_pc, 1) + "% in " + L.year)} — about ${hlt("one in " + Math.round(100 / L.marginal_pc) + " seats")} decided on a knife-edge.`,
      note: `A small margin can mean two different things: a genuine two-way cliffhanger, or a multi-cornered split that hands a bloc the seat on a thin plurality. Read this alongside <a href="#multi-cornered">multi-cornered contests</a> above.`,
      method: {
        eq: String.raw`m = \dfrac{\lvert\{\, i : d_i < 5 \,\}\rvert}{n}`,
        where: `<strong>d<sub>i</sub></strong> is the winning margin in seat <em>i</em> — the winner's lead over the runner-up, in percentage points of the valid vote — and <strong>n</strong> is the number of seats. So <em>m</em> is the share of seats decided by under 5 points. Uncontested seats have no margin and count as safe, which they are.`,
      },
    },
    /* 9 ─ do people show up */
    {
      id: "turnout", h2: "Turnout", q: "Do Malaysians show up?",
      now: num(L.turnout ?? 0) + "%",
      nowCap: `turnout in ${L.year}, the first election with automatic registration and voting at 18.`,
      share: `Malaysian turnout has held between ${num(tLow.turnout ?? 0)}% and ${num(tPeak.turnout ?? 0)}% for seven decades, peaking at ${num(tPeak.turnout ?? 0)}% in ${tPeak.year}.`,
      opts: {
        series: [{ label: "Turnout", color: C.gold, focal: true, y: (r) => r.turnout }],
        yLabel: "Voter turnout", fmt: (v) => num(v) + "%", yMin: 60, yMax: 90,
        points: [{ year: tLow.year, value: tLow.turnout ?? 0, tag: "low", place: "below" }, { year: tPeak.year, value: tPeak.turnout ?? 0, tag: "peak" }, { year: L.year, value: L.turnout ?? 0, tag: "now", place: "below" }],
      },
      body: `Turnout has stayed high — between ${hlg(num(tLow.turnout ?? 0) + "% and " + num(tPeak.turnout ?? 0) + "%")} across seven decades. The peak was ${hlg(num(tPeak.turnout ?? 0) + "% in " + tPeak.year)}, the most fiercely contested election of the BN era. It then fell to ${hlg(num(L.turnout ?? 0) + "%")} in ${L.year}, a drop of ${hlg(num(tDrop, 1) + " points")} from ${tPrev.year}, despite millions of newly-enrolled young voters under automatic registration and Undi18 — a puzzle worth its own study.`,
      method: {
        eq: String.raw`T = \dfrac{1}{n} \textstyle\sum_c \dfrac{b_c}{e_c}`,
        where: `for each seat <em>c</em>, <strong>b<sub>c</sub></strong> is ballots cast and <strong>e<sub>c</sub></strong> registered electors; <strong>n</strong> is the number of seats. The denominator is <em>registered</em> voters — so before automatic registration in 2018, ${hlt("older figures overstate participation among the voting-age population")}, because many eligible adults were never on the roll.`,
      },
    },
    /* 10 ─ who actually gets elected */
    {
      id: "women", h2: "Women in Parliament", q: "Who actually gets elected?",
      now: num(L.women_pc, 1) + "%",
      nowCap: `of MPs elected in ${L.year} were women — a chamber that looks little like the electorate it answers to.`,
      share: `Malaysia's Parliament is ${num(L.women_pc, 1)}% women (${L.year}) — up from near-zero in ${F.year}, but still well below the ~30% many democracies treat as a floor.`,
      opts: {
        series: [{ label: "Women MPs", color: C.red, focal: true, y: (r) => r.women_pc }],
        yLabel: "Share of women MPs", fmt: (v) => num(v, 1) + "%", yMin: 0,
        yRefs: [{ at: 30, label: "~30% common benchmark" }],
        points: [{ year: F.year, value: F.women_pc, tag: "near zero" }, { year: wPeak.year, value: wPeak.women_pc, tag: "peak" }, { year: L.year, value: L.women_pc, tag: "now", place: "below" }],
      },
      body: `The people's house has never resembled the people who elect it. Women held just ${hl(num(F.women_pc, 1) + "% of seats in " + F.year)}; the share climbed to a peak of ${hl(num(wPeak.women_pc, 1) + "% in " + wPeak.year)}, then eased to ${hl(num(L.women_pc, 1) + "% in " + L.year)}. That leaves Parliament far below the ${hlt("~30%")} many democracies treat as a floor — and further still from the half of the population women make up.`,
      note: `This is <em>descriptive</em> representation — who sits in the chamber — not how they vote. Read it alongside <a href="#ethnicity">Parliament's ethnic makeup</a> below.`,
      method: {
        eq: String.raw`w = \dfrac{W}{n}`,
        where: `<strong>W</strong> is the number of elected women MPs and <strong>n</strong> the total number of seats, so <em>w</em> is simply the share of the winning benches who are women — the single clearest check on how much Parliament resembles the electorate. Read it alongside <a href="#ethnicity">Parliament's ethnic makeup</a> below.`,
      },
    },
  ];
}

/* ---------- render ---------- */
function methodHTML(m: Method, eqNo: number | null): string {
  let inner = "";
  if (m.eq) {
    const tex = katex.renderToString(m.eq, { displayMode: true, throwOnError: false });
    inner += `<div class="eqrow"><div class="eq">${tex}</div><div class="eqno">(${eqNo})</div></div>`;
    if (m.where) inner += `<p class="where">${m.where}</p>`;
  } else if (m.text) {
    inner += `<p class="where">${m.text}</p>`;
  }
  return `<details class="method"><summary><span class="chev"></span>How it's measured</summary><div class="method-body">${inner}</div></details>`;
}

function sectbar(s: Sec): string {
  return `<div class="sectbar">
    <button class="sharex" data-share="${s.id}" title="Share this section on X">${X_ICON} Share</button>
  </div>`;
}

function render() {
  const secs = sections();
  const F = first(), L = last();
  let eqCount = 0;
  const eqNos = secs.map((s) => (s.method.eq ? ++eqCount : null));

  app.innerHTML = `
  <header class="hero"><div class="wrap">
    <div class="kicker">Nadi Demokrasi · The Pulse of Democracy</div>
    <h1>Malaysia's democracy,<br>in numbers</h1>
    <p class="dek">Seven decades of general elections measured with the standard tools of political science — disproportionality, malapportionment, fragmentation, competitiveness, representation and turnout.</p>
    <div class="meta">${ROWS.length} federal general elections · ${F.year}–${L.year} · reproducible &amp; citable</div>
    <div class="herobtns">
      <button class="btn" id="shareBtn">${X_ICON} Share</button>
      <a class="btn" href="${BASE}data/nadi-demokrasi-data.zip" download>↓ Data</a>
      <button class="btn" id="citeBtn">❝ Cite</button>
    </div>
  </div></header>
  <div class="wrap">
    <div class="lede">
      <p>Numbers don't capture everything about a democracy — but a handful of well-defined indices, each measured the same way at every election, reveal the deep shifts that headlines miss. Here are ${secs.length}, drawn from the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> — each revealing a different dimension of the health of Malaysia's political system.</p>
    </div>
    ${secs.map((s, i) => `
      <section class="ind" id="${s.id}">
        <div class="ind-head">
          <a class="anchor" href="#${s.id}" data-link="${s.id}" title="Copy link to this section" aria-label="Copy link to this section">#</a>
          <div><h2>${s.h2}</h2><div class="q">${s.q}</div></div>
          ${sectbar(s)}
        </div>
        <div class="bignow"><span class="v">${s.now}</span><span class="cap">${s.nowCap}</span></div>
        <div class="chartbox"><div class="chart" data-sec="${s.id}"></div></div>
        <p class="body">${s.body}</p>
        ${s.note ? `<p class="note">${s.note}</p>` : ""}
        ${methodHTML(s.method, eqNos[i])}
      </section>`).join("")}

    <div class="method-sec" id="limitations">
      <h2 class="sans">Method &amp; limitations</h2>
      <p>Every figure here is computed from official results by one short, open script. The unit of analysis is each election's <b>blocs</b>: a candidate's coalition where they ran in one, otherwise their party (so non-aligned parties are their own bloc; independents share one). Vote shares use valid votes; seat shares use the federal seats of each election — a number that itself grew from ${F.n_seats} in ${F.year} to ${L.n_seats} in ${L.year} as the country and its parliament expanded.</p>
      <h3 class="sans">What these indicators do <em>not</em> capture</h3>
      <ul>
        <li><b>The malapportionment index is a floor, not the whole story.</b> It measures unequal <em>registered</em> electors per seat; it does not capture differences between registered and voting-age population, and it does not say <em>which</em> bloc the unequal map favours (a partisan-bias/"efficiency-gap" measure would — a natural next addition).</li>
        <li><b>Gallagher still bundles both distortions.</b> The disproportionality score reports the <em>total</em> vote-to-seat gap; malapportionment and the winner's bonus are shown separately, but the corpus does not let us cleanly attribute every point of Gallagher to one or the other.</li>
        <li><b>Vote volatility ≠ seat upheaval.</b> Pedersen volatility tracks how much <em>vote share</em> moves between blocs. A result like 2008 can transform parliament while moving relatively few votes, so the chart understates seat-level "earthquakes". Read it alongside the seat bonus.</li>
        <li><b>Bloc definition is a choice.</b> Effective-parties and Gallagher figures depend on counting coalitions as the unit rather than individual parties; we use coalitions because that is how Malaysian governments form, but a party-level reading would give higher fragmentation and different disproportionality.</li>
        <li><b>Coalition continuity in East Malaysia.</b> Sabah and Sarawak parties have shifted between federal coalitions repeatedly; the rename-collapsing rule handles clean successions but cannot perfectly track fluid, partial realignments.</li>
        <li><b>Uncontested seats and the turnout denominator.</b> Early elections had many uncontested seats (counted as won, with no turnout), and turnout uses <em>registered</em> electors — so pre-2018 turnout overstates participation among all eligible adults, before automatic registration put everyone on the roll.</li>
        <li><b>Federal general elections only.</b> State elections, by-elections, and the timing differences for Sabah (joined 1963) and Sarawak (first federal vote 1969) are excluded; this is a federal-parliament story, not a complete account of every ballot cast.</li>
        <li><b>No competitiveness, marginality, or descriptive-representation measure yet.</b> The indicators describe the national party system, not how close individual seats were, nor who the MPs are (the corpus does carry candidate sex and ethnicity, and seat margins — natural further dimensions).</li>
      </ul>
      <div class="dl">
        <button class="citelink" id="shareBtn2">${X_ICON} Share</button>
        <a href="${BASE}data/nadi-demokrasi-data.zip" download>↓ Data</a>
        <a href="https://github.com/zachtheyek/nadi-demokrasi" target="_blank" rel="noopener">${GH_ICON} Source</a>
        <button class="citelink" id="citeBtn2">❝ Cite</button>
      </div>
    </div>
    <footer>
      Built on the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> by <a href="https://x.com/Thevesh" target="_blank" rel="noopener">Thevesh Thevananthan</a> (CC0), peer-reviewed in <i>Scientific Data</i> 13, 190 (2026). Not affiliated with the author. Indicators follow Laakso–Taagepera (1979), Gallagher (1991), Pedersen (1979) and Samuels–Snyder (2001).
    </footer>
  </div>`;

  secs.forEach((s) => renderChart(app.querySelector(`[data-sec="${s.id}"]`)!, s.opts));
  document.getElementById("citeBtn")?.addEventListener("click", openCite);
  document.getElementById("citeBtn2")?.addEventListener("click", openCite);
  const shareAll = () => shareOnX(`Nadi Demokrasi — Malaysia's democracy in numbers, ${F.year}–${L.year}: ${secs.length} political-science indicators across ${ROWS.length} general elections.`, SITE);
  document.getElementById("shareBtn")?.addEventListener("click", shareAll);
  document.getElementById("shareBtn2")?.addEventListener("click", shareAll);
  // per-section copy-link + X share
  app.querySelectorAll<HTMLElement>(".anchor").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const id = a.dataset.link!;
    history.replaceState(null, "", "#" + id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    copy(SITE + "#" + id, "Section link copied");
  }));
  app.querySelectorAll<HTMLElement>(".sharex").forEach((b) => b.addEventListener("click", () => {
    const s = secs.find((x) => x.id === b.dataset.share)!;
    shareOnX(s.share + " — via Nadi Demokrasi.", SITE + "#" + s.id);
  }));
  // deep-link on load (content is fetched async, so scroll after render)
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) setTimeout(() => el.scrollIntoView(), 40); }
}

function shareOnX(text: string, url: string) {
  const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(u, "_blank", "noopener");
}
async function copy(txt: string, msg: string) {
  try { await navigator.clipboard.writeText(txt); showToast(msg); } catch { showToast("Copy failed"); }
}

/* ---------- cite modal ---------- */
function citations() {
  const F = first(), L = last();
  const today = new Date().toISOString().slice(0, 10);
  const pubYear = new Date().getFullYear();
  const url = "https://zachtheyek.github.io/nadi-demokrasi/";
  const apa = `Yek, Z. (${pubYear}). Nadi Demokrasi: Malaysia's democracy in numbers (${F.year}–${L.year}) [Interactive dashboard]. Built on the Malaysian Election Corpus (Thevananthan, 2026). ORCID: https://orcid.org/${ORCID}. Retrieved ${today}, from ${url}`;
  const bib = `@misc{nadidemokrasi,
  author       = {Yek, Zach},
  title        = {Nadi Demokrasi: Malaysia's Democracy in Numbers (${F.year}--${L.year})},
  year         = {${pubYear}},
  howpublished = {\\url{${url}}},
  note         = {Interactive dashboard built on the Malaysian Election Corpus. ORCID 0000-0002-2532-4883},
  urldate      = {${today}}
}

@article{meco2026,
  author  = {Thevananthan, Thevesh},
  title   = {The Malaysian Election Corpus},
  journal = {Scientific Data},
  volume  = {13},
  pages   = {190},
  year    = {2026},
  note    = {Dataset DOI: 10.5281/zenodo.17694675}
}`;
  return { apa, bib };
}

let citeBox: HTMLElement | null = null;
function openCite() {
  if (citeBox) { citeBox.remove(); citeBox = null; return; }
  const { apa, bib } = citations();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  citeBox = document.createElement("div");
  citeBox.className = "citemodal";
  citeBox.innerHTML = `
    <div class="citecard">
      <div class="citehd"><span>Cite this work</span><button class="citex" aria-label="close">×</button></div>
      <p class="citenote">Analysis by <a href="https://x.com/zachtheyek" target="_blank" rel="noopener">Zach Yek</a> (ORCID: <a href="https://orcid.org/${ORCID}" target="_blank" rel="noopener">${ORCID}</a>). Please also credit the underlying data — the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> by <a href="https://x.com/Thevesh" target="_blank" rel="noopener">Thevesh Thevananthan</a>.</p>
      <div class="citeblock">
        <div class="citelabel">APA <button class="copy" data-k="apa">Copy</button></div>
        <pre>${esc(apa)}</pre>
      </div>
      <div class="citeblock">
        <div class="citelabel">BibTeX <button class="copy" data-k="bib">Copy</button></div>
        <pre>${esc(bib)}</pre>
      </div>
    </div>`;
  document.body.appendChild(citeBox);
  const close = () => { citeBox?.remove(); citeBox = null; };
  citeBox.addEventListener("click", (e) => { if (e.target === citeBox) close(); });
  citeBox.querySelector(".citex")?.addEventListener("click", close);
  citeBox.querySelectorAll<HTMLButtonElement>(".copy").forEach((b) => b.addEventListener("click", () => copy(b.dataset.k === "apa" ? apa : bib, "Citation copied")));
}

let rt: any;
addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 150); });

(async () => {
  app.innerHTML = `<div class="loading">Loading indicators…</div>`;
  ROWS = (await fetch(`${BASE}data/indicators.json`).then((r) => r.json())).rows;
  render();
})();
