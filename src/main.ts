import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "katex/dist/katex.min.css";
import katex from "katex";
import "./style.css";

const BASE = import.meta.env.BASE_URL;
const app = document.getElementById("app")!;

interface Row {
  election: string; year: number; n_seats: number; n_blocs: number;
  enp_votes: number; enp_seats: number; gallagher: number; volatility: number | null;
  turnout: number | null; winner: string; winner_vote_pc: number; winner_seat_pc: number; winner_seat_bonus: number;
}
let ROWS: Row[] = [];

// palette (light theme) — clay red is the single accent; teal & gold are muted context hues
const C = { red: "#b3402f", teal: "#2f6f6b", gold: "#c08a2d", ink: "#16130f", muted: "#6b6256", grid: "#e3ddd0", context: "#a99f8c" };

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
   range frames (axes span only the data), direct end-labels (no legend), a single
   accent on the focal series, endpoint value labels, faint gridlines, data-derived
   annotations passed in by the caller. */
interface Series { label: string; color: string; focal?: boolean; y: (r: Row) => number | null; }
interface ChartOpts {
  series: Series[];
  yMin?: number; yMax?: number; yLabel: string;
  fmt: (v: number) => string; unit?: string;
  annotations?: { year: number; text: string }[];
  gapFill?: boolean;       // shade the gap between series[0] and series[1]
  zeroLine?: boolean;      // draw a reference line at y = 0 when it sits inside the range
}

function renderChart(host: HTMLElement, o: ChartOpts) {
  const W = Math.max(300, host.clientWidth);
  const H = Math.min(300, Math.max(220, W * 0.52));
  const m = { t: 18, r: 96, b: 26, l: 34 };
  const years = ROWS.map((r) => r.year);
  const xMin = Math.min(...years), xMax = Math.max(...years);
  const all = o.series.flatMap((s) => ROWS.map(s.y).filter((v): v is number => v != null));
  const yMax = o.yMax ?? Math.max(...all) * 1.1;
  const yMin = o.yMin ?? Math.min(0, Math.min(...all));
  const x = (yr: number) => m.l + (yr - xMin) / (xMax - xMin) * (W - m.l - m.r);
  const y = (v: number) => H - m.b - (v - yMin) / (yMax - yMin) * (H - m.t - m.b);
  const plotTop = m.t, plotBot = H - m.b;

  let g = "";
  // faint horizontal gridlines, labelled at left (kept minimal)
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + (yMax - yMin) * i / ticks;
    const yy = y(v).toFixed(1);
    g += `<line class="gl" x1="${m.l}" y1="${yy}" x2="${W - m.r}" y2="${yy}"/><text class="axt" x="${m.l - 6}" y="${(+yy + 3).toFixed(1)}" text-anchor="end">${o.fmt(v)}</text>`;
  }
  // range frame: axis lines span only where the data lives
  g += `<line class="frame" x1="${m.l}" y1="${plotTop}" x2="${m.l}" y2="${plotBot}"/>`;
  g += `<line class="frame" x1="${m.l}" y1="${plotBot}" x2="${x(xMax).toFixed(1)}" y2="${plotBot}"/>`;
  // zero reference (e.g. the seat-bonus chart, where crossing 0 is the story)
  if (o.zeroLine && yMin < 0 && yMax > 0) {
    g += `<line class="zero" x1="${m.l}" y1="${y(0).toFixed(1)}" x2="${(W - m.r).toFixed(1)}" y2="${y(0).toFixed(1)}"/>`;
  }
  // x labels (every other election, always the last)
  ROWS.forEach((r, i) => { if (i % 2 === 0 || i === ROWS.length - 1) g += `<text class="axt" x="${x(r.year).toFixed(1)}" y="${H - 8}" text-anchor="middle">${String(r.year).slice(2)}</text>`; });
  // computed annotations (faint vertical marker + small label near the top)
  (o.annotations || []).forEach((a) => {
    const ax = x(a.year);
    g += `<line class="annot" x1="${ax.toFixed(1)}" y1="${plotTop}" x2="${ax.toFixed(1)}" y2="${plotBot}"/><text class="annott" x="${(ax + 4).toFixed(1)}" y="${plotTop + 9}">${a.text}</text>`;
  });

  // gap fill between the two series (shows the seat bonus / squeeze directly)
  if (o.gapFill && o.series.length === 2) {
    const pa = ROWS.map((r) => ({ yr: r.year, v: o.series[0].y(r) })).filter((p) => p.v != null) as { yr: number; v: number }[];
    const pb = ROWS.map((r) => ({ yr: r.year, v: o.series[1].y(r) })).filter((p) => p.v != null) as { yr: number; v: number }[];
    if (pa.length && pa.length === pb.length) {
      const top = pa.map((p) => `${x(p.yr).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
      const bot = pb.slice().reverse().map((p) => `${x(p.yr).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
      g += `<polygon class="gapfill" points="${top} ${bot}"/>`;
    }
  }

  // series lines + direct end-labels
  const ends: { yr: number; v: number; label: string; color: string; focal: boolean }[] = [];
  o.series.forEach((s) => {
    const pts = ROWS.map((r) => ({ r, v: s.y(r) })).filter((p) => p.v != null) as { r: Row; v: number }[];
    if (!pts.length) return;
    const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.r.year).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    g += `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="${s.focal ? 2.6 : 1.8}" stroke-linejoin="round" stroke-linecap="round"/>`;
    // invisible-ish hover targets on every point
    g += pts.map((p) => `<circle class="dot" cx="${x(p.r.year).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="9" fill="transparent" data-y="${p.r.year}" data-v="${p.v}" data-l="${s.label}" data-w="${p.r.winner}"/>`).join("");
    const e = pts[pts.length - 1];
    ends.push({ yr: e.r.year, v: e.v, label: s.label, color: s.color, focal: !!s.focal });
  });

  // resolve vertical collisions between end-labels, then draw endpoint dot + value + name
  ends.sort((a, b) => y(a.v) - y(b.v));
  let prevY = -1e9;
  ends.forEach((e) => {
    let ly = y(e.v);
    if (ly - prevY < 15) ly = prevY + 15;
    prevY = ly;
    const ex = x(e.yr);
    g += `<circle cx="${ex.toFixed(1)}" cy="${y(e.v).toFixed(1)}" r="${e.focal ? 4 : 3.2}" fill="${e.color}"/>`;
    g += `<line class="leader" x1="${(ex + 5).toFixed(1)}" y1="${y(e.v).toFixed(1)}" x2="${(ex + 11).toFixed(1)}" y2="${ly.toFixed(1)}"/>`;
    g += `<text class="endlab ${e.focal ? "focal" : ""}" x="${(ex + 13).toFixed(1)}" y="${(ly - 4).toFixed(1)}" fill="${e.color}">${o.fmt(e.v)}${o.unit || ""}</text>`;
    g += `<text class="endname" x="${(ex + 13).toFixed(1)}" y="${(ly + 8).toFixed(1)}">${e.label}</text>`;
  });

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${o.yLabel}">${g}</svg>`;
  host.querySelectorAll(".dot").forEach((d) => {
    const el = d as SVGElement;
    const move = (ev: any) => {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      showTip(`<div class="y">${el.dataset.y} · ${el.dataset.l}</div>${o.fmt(+el.dataset.v!)}${o.unit || ""}<br><span style="color:#bbb">won by ${el.dataset.w}</span>`, cx, cy);
    };
    el.addEventListener("mouseenter", move);
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("touchstart", move, { passive: true });
  });
}

/* ---------- method dropdown (LaTeX + plain English, hidden by default) ---------- */
interface Method { eq?: string; where?: string; text?: string; }
interface Sec { id: string; h2: string; q: string; now: string; nowCap: string; opts: ChartOpts; body: string; note?: string; method: Method; }

function sections(): Sec[] {
  const L = last(), F = first();

  // disproportionality
  const gPeak = arg("gallagher", 1);
  // seat bonus
  const bPeak = arg("winner_seat_bonus", 1);
  const minorityWins = ROWS.filter((r) => r.winner_vote_pc < 50 && r.winner_seat_pc > 50);
  const minRecent = minorityWins.length ? minorityWins[minorityWins.length - 1].year : null;
  // fragmentation
  const enpPeak = arg("enp_seats", 1);
  // volatility — the genuine top spikes by THIS measure (not the seat-level "tsunami" lore)
  const volRanked = ROWS.filter((r) => r.volatility != null).sort((a, b) => (b.volatility! - a.volatility!));
  const topVol = volRanked.slice(0, 4).map((r) => r.year).sort((a, b) => a - b);
  const r2008 = at(2008);
  // turnout
  const tMax = arg("turnout", 1), tMin = arg("turnout", -1);
  const tPrev = ROWS[ROWS.length - 2];
  const tDrop = (tPrev.turnout != null && L.turnout != null) ? (tPrev.turnout - L.turnout) : 0;
  // dominance — first election the winner fell below a two-thirds seat share, coming from above
  let twoThirdsYr: number | null = null;
  for (let i = 1; i < ROWS.length; i++) {
    if (ROWS[i].winner_seat_pc < 200 / 3 && ROWS[i - 1].winner_seat_pc >= 200 / 3) { twoThirdsYr = ROWS[i].year; break; }
  }

  const hl = (s: string) => `<span class="hl">${s}</span>`;     // clay red — focal
  const hlt = (s: string) => `<span class="hl-t">${s}</span>`;   // teal — secondary
  const hlg = (s: string) => `<span class="hl-g">${s}</span>`;   // gold — tertiary

  return [
    {
      id: "disproportionality", h2: "Disproportionality", q: "How faithfully do votes turn into seats?",
      now: num(L.gallagher, 1),
      nowCap: `Gallagher index in ${L.year} — down from a peak of ${num(gPeak.gallagher, 1)} in ${gPeak.year}.`,
      opts: {
        series: [{ label: "Gallagher", color: C.red, focal: true, y: (r) => r.gallagher }],
        yLabel: "Gallagher disproportionality", fmt: (v) => num(v, 1),
        annotations: [{ year: gPeak.year, text: "peak" }],
      },
      body: `For half a century, Malaysia's first-past-the-post system turned modest vote leads into commanding majorities. Disproportionality peaked at ${hl(num(gPeak.gallagher, 1) + " in " + gPeak.year)}, when the winning bloc (${gPeak.winner}) converted ${hl(num(gPeak.winner_vote_pc) + "%")} of the vote into ${hl(num(gPeak.winner_seat_pc) + "%")} of seats. By ${L.year} it had fallen to ${hlt(num(L.gallagher, 1))}. A score above about 12 is high by world standards; established proportional systems sit near 2–5.`,
      note: `This index measures only how vote shares map to seat shares. It does not separate the mechanical effect of single-member districts from <em>malapportionment</em> — seats holding very different numbers of voters — which is also large in Malaysia. Both inflate the score; the dashboard reports the total. See <a href="#limitations">limitations</a>.`,
      method: {
        eq: String.raw`\mathrm{LSq} = \sqrt{\tfrac{1}{2} \textstyle\sum_i (v_i - s_i)^2}`,
        where: `<strong>v<sub>i</sub></strong> and <strong>s<sub>i</sub></strong> are bloc <em>i</em>'s share of the valid vote and of seats, in percentage points. A perfectly proportional result — every bloc's seat share equal to its vote share — scores 0; the bigger the score, the larger the gap between votes cast and seats won.`,
      },
    },
    {
      id: "seat-bonus", h2: "The winner's bonus", q: "How much does the system inflate the largest bloc?",
      now: (L.winner_seat_bonus >= 0 ? "+" : "") + num(L.winner_seat_bonus, 1),
      nowCap: `percentage-point gap between the winner's seat share and vote share in ${L.year} — the bonus has vanished.`,
      opts: {
        series: [
          { label: "Seat share", color: C.red, focal: true, y: (r) => r.winner_seat_pc },
          { label: "Vote share", color: C.teal, y: (r) => r.winner_vote_pc },
        ],
        yLabel: "Winner's seat share vs vote share", fmt: (v) => num(v) + "%", yMin: 0, yMax: 100, gapFill: true,
      },
      body: `The gap between the winner's seats (red) and votes (teal) is the bonus first-past-the-post hands the largest bloc. It peaked at ${hl("+" + num(bPeak.winner_seat_bonus, 1) + " points in " + bPeak.year)}, when ${bPeak.winner} turned ${num(bPeak.winner_vote_pc)}% of votes into ${num(bPeak.winner_seat_pc)}% of seats.${minRecent ? ` On ${minorityWins.length === 1 ? "one occasion" : minorityWins.length + " occasions"} the largest bloc even won a majority of seats on a ${hlt("minority of the vote")} — most recently in ${minRecent}.` : ""} By ${hl(String(L.year))} the bonus had vanished (${hl(num(L.winner_seat_bonus, 1))}): for the first time, the largest bloc held a smaller share of seats than of votes, in a hung parliament.`,
      method: {
        text: `The seat bonus is simply the winning bloc's share of seats minus its share of the valid vote, in percentage points. A positive bonus means the system magnified the leader into a larger parliamentary presence than its votes alone would justify; a negative bonus means it under-rewarded them. No formula beyond that subtraction is involved.`,
      },
    },
    {
      id: "fragmentation", h2: "Fragmentation", q: "How many parties really matter?",
      now: num(L.enp_seats, 1),
      nowCap: `effective number of parliamentary parties in ${L.year} — the most fragmented in this record.`,
      opts: {
        series: [
          { label: "By seats", color: C.red, focal: true, y: (r) => r.enp_seats },
          { label: "By votes", color: C.gold, y: (r) => r.enp_votes },
        ],
        yLabel: "Effective number of parties", fmt: (v) => num(v, 1), yMin: 1, gapFill: true,
      },
      body: `The effective number of parties weights each bloc by its size, so a few dominant blocs count for less than many even ones. Malaysia spent decades as a ${hlt("one-and-a-half-party system")} — about ${num(F.enp_votes, 1)} effective parties by votes in ${F.year}. It has climbed to ${hl(num(enpPeak.enp_seats, 1) + " by " + enpPeak.year)}, a genuine three-way contest between PH, PN and BN. For decades the seats line sat below the votes line — first-past-the-post squeezing smaller blocs out of parliament — until ${enpPeak.year}, when a fragmented result closed the gap.`,
      method: {
        eq: String.raw`N = \dfrac{1}{\sum_i p_i^{\,2}}`,
        where: `<strong>p<sub>i</sub></strong> is bloc <em>i</em>'s share — of votes for the votes line, of seats for the seats line. Two equally-sized blocs give N = 2; one dominant bloc pulls N toward 1. It is the Laakso–Taagepera index, the standard count of "parties that matter".`,
      },
    },
    {
      id: "volatility", h2: "Volatility", q: "How much does the vote move between elections?",
      now: num(L.volatility ?? 0),
      nowCap: `Pedersen volatility in ${L.year} — among the largest vote swings on record.`,
      opts: {
        series: [{ label: "Pedersen", color: C.teal, focal: true, y: (r) => r.volatility }],
        yLabel: "Electoral volatility", fmt: (v) => num(v),
        annotations: topVol.map((yr) => ({ year: yr, text: String(yr).slice(2) })),
      },
      body: `Pedersen volatility sums how much each bloc's vote share shifts from one election to the next. The largest realignments by this measure came in ${hl(topVol.join(", "))} — each a wholesale redrawing of who voted for whom. The calm stretches between, such as the early 1980s, mark periods of entrenched one-coalition dominance.`,
      note: r2008 ? `A caution on reading this chart: the ${r2008.year} "political tsunami" — when the ruling coalition lost its two-thirds majority — barely registers here (${num(r2008.volatility ?? 0)}). That shock was about <em>seats</em>, not vote share: BN still won ${num(r2008.winner_vote_pc)}% of the vote, so relatively little support actually moved between blocs. Vote volatility and seat change can tell very different stories.` : undefined,
      method: {
        eq: String.raw`V = \tfrac{1}{2} \textstyle\sum_i \lvert v_{i,t} - v_{i,t-1} \rvert`,
        where: `<strong>v<sub>i,t</sub></strong> is bloc <em>i</em>'s vote share at election <em>t</em>. Blocs are matched across elections with pure renames collapsed (PERIKATAN→BN, BA→PR→PH), so relabelling is not counted as change — but genuine splits and mergers are. The first election has no prior to compare against, so it has no value.`,
      },
    },
    {
      id: "turnout", h2: "Turnout", q: "Do Malaysians show up?",
      now: num(L.turnout ?? 0) + "%",
      nowCap: `turnout in ${L.year}, the first election with automatic registration and voting at 18.`,
      opts: {
        series: [{ label: "Turnout", color: C.gold, focal: true, y: (r) => r.turnout }],
        yLabel: "Voter turnout", fmt: (v) => num(v) + "%", yMin: 60, yMax: 90,
        annotations: [{ year: tMax.year, text: "record" }],
      },
      body: `Turnout has stayed high — between ${hlg(num(tMin.turnout ?? 0) + "% and " + num(tMax.turnout ?? 0) + "%")} across seven decades. The record was ${hl(num(tMax.turnout ?? 0, 1) + "% in " + tMax.year)}, the most fiercely contested election of the BN era. It then fell to ${num(L.turnout ?? 0)}% in ${L.year}, a drop of ${num(tDrop, 1)} points from ${tPrev.year}, despite millions of newly-enrolled young voters under automatic registration and Undi18 — a puzzle worth its own study.`,
      method: {
        text: `Turnout is ballots cast divided by registered electors, averaged across all federal seats in the election. Note the denominator is <em>registered</em> voters: before automatic registration in 2018, many eligible adults were never on the roll, so older figures overstate participation among the voting-age population.`,
      },
    },
    {
      id: "dominance", h2: "The end of the majority party", q: "Is anyone still dominant?",
      now: num(L.winner_vote_pc) + "%",
      nowCap: `the winning bloc's vote share in ${L.year} — the lowest in this record.`,
      opts: {
        series: [{ label: "Winner vote %", color: C.red, focal: true, y: (r) => r.winner_vote_pc }],
        yLabel: "Winner's vote share", fmt: (v) => num(v) + "%", yMin: 0, yMax: 90,
        annotations: twoThirdsYr ? [{ year: twoThirdsYr, text: "⅔ lost" }] : [],
      },
      body: `The winning coalition's share of the popular vote has fallen from ${hl(num(F.winner_vote_pc) + "% in " + F.year)} to ${hl(num(L.winner_vote_pc) + "% in " + L.year)} — the lowest on record.${twoThirdsYr ? ` The two-thirds parliamentary supermajority, long the benchmark of dominance, was lost for good in ${hlt(String(twoThirdsYr))}.` : ""} Malaysia has moved decisively from a dominant-party system to competitive, coalition-by-coalition politics.`,
      method: {
        text: `The "winner" is the bloc that took the most seats; this line is its share of all valid federal votes cast that year. It is a level, not a formula — but read it alongside fragmentation: a falling winner's share and a rising effective number of parties are two views of the same shift to multi-bloc competition.`,
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

function render() {
  const secs = sections();
  const F = first(), L = last();
  // assign equation numbers in document order (only sections with a real equation get one)
  let eqCount = 0;
  const eqNos = secs.map((s) => (s.method.eq ? ++eqCount : null));

  app.innerHTML = `
  <header class="hero"><div class="wrap">
    <div class="kicker">Nadi Demokrasi · The Pulse of Democracy</div>
    <h1>Malaysia's democracy,<br>in numbers</h1>
    <p class="dek">Seven decades of general elections measured with the standard tools of political science — disproportionality, fragmentation, volatility and turnout.</p>
    <div class="meta">${ROWS.length} federal general elections · ${F.year}–${L.year} · reproducible &amp; citable</div>
    <div class="herobtns">
      <button class="btn" id="citeBtn">❝ Cite this work</button>
      <a class="btn" href="${BASE}data/indicators.csv" download>↓ Data (CSV)</a>
    </div>
  </div></header>
  <div class="wrap">
    <div class="lede">
      <p>Numbers don't capture everything about a democracy — but a handful of well-defined indices, computed the same way every election, reveal the deep shifts that headlines miss. Here are six, drawn from the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a>, each with its full history and the method behind it. Every figure on this page is recomputed from the source data, so it updates as new elections are added.</p>
    </div>
    ${secs.map((s, i) => `
      <section class="ind" id="${s.id}">
        <h2>${s.h2}</h2>
        <div class="q">${s.q}</div>
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
        <li><b>Malapportionment and gerrymandering.</b> Gallagher and the seat bonus measure the <em>total</em> gap between votes and seats, but cannot separate the mechanical effect of single-member plurality from unequal electorates per seat (rural seats hold far fewer voters than urban ones). Both are real and both inflate the figures; decomposing them would need a separate malapportionment index, which this dashboard does not yet compute.</li>
        <li><b>Vote volatility ≠ seat upheaval.</b> Pedersen volatility tracks how much <em>vote share</em> moves between blocs. A result like 2008 can transform parliament while moving relatively few votes, so the chart understates seat-level "earthquakes". Read it alongside the seat bonus.</li>
        <li><b>Bloc definition is a choice.</b> Effective-parties and Gallagher figures depend on counting coalitions as the unit rather than individual parties; we use coalitions because that is how Malaysian governments form, but a party-level reading would give higher fragmentation and different disproportionality.</li>
        <li><b>Coalition continuity in East Malaysia.</b> Sabah and Sarawak parties have shifted between federal coalitions repeatedly; the rename-collapsing rule handles clean successions but cannot perfectly track fluid, partial realignments.</li>
        <li><b>Uncontested seats and the turnout denominator.</b> Early elections had many uncontested seats (counted as won, with no turnout), and turnout uses <em>registered</em> electors — so pre-2018 turnout overstates participation among all eligible adults, before automatic registration put everyone on the roll.</li>
        <li><b>Federal general elections only.</b> State elections, by-elections, and the timing differences for Sabah (joined 1963) and Sarawak (first federal vote 1969) are excluded; this is a federal-parliament story, not a complete account of every ballot cast.</li>
        <li><b>No competitiveness or marginality measure.</b> The indicators describe the national party system, not how close individual seats were — a natural next dimension to add.</li>
      </ul>
      <div class="dl">
        <a href="${BASE}data/indicators.csv" download>↓ indicators.csv</a>
        <a href="${BASE}data/indicators.json" download>↓ indicators.json</a>
        <a href="https://github.com/zachtheyek/nadi-demokrasi" target="_blank" rel="noopener">Source &amp; formulae →</a>
        <button class="citelink" id="citeBtn2">❝ Cite this work</button>
      </div>
    </div>
    <footer>
      Built on the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> by <a href="https://x.com/Thevesh" target="_blank" rel="noopener">Thevesh Thevananthan</a> (CC0), peer-reviewed in <i>Scientific Data</i> 13, 190 (2026). Not affiliated with the author. Indicators follow Laakso–Taagepera (1979), Gallagher (1991) and Pedersen (1979).
    </footer>
  </div>`;

  secs.forEach((s) => renderChart(app.querySelector(`[data-sec="${s.id}"]`)!, s.opts));
  document.getElementById("citeBtn")?.addEventListener("click", openCite);
  document.getElementById("citeBtn2")?.addEventListener("click", openCite);
}

/* ---------- cite modal ---------- */
function citations() {
  const F = first(), L = last();
  const today = new Date().toISOString().slice(0, 10);
  const pubYear = new Date().getFullYear();   // year the dashboard is cited, not the last election
  const url = "https://zachtheyek.github.io/nadi-demokrasi/";
  const apa = `Yek, Z. (${pubYear}). Nadi Demokrasi: Malaysia's democracy in numbers (${F.year}–${L.year}) [Interactive dashboard]. Built on the Malaysian Election Corpus (Thevananthan, 2026). Retrieved ${today}, from ${url}`;
  const bib = `@misc{nadidemokrasi,
  author       = {Yek, Zach},
  title        = {Nadi Demokrasi: Malaysia's Democracy in Numbers (${F.year}--${L.year})},
  year         = {${pubYear}},
  howpublished = {\\url{${url}}},
  note         = {Interactive dashboard built on the Malaysian Election Corpus},
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
  citeBox = document.createElement("div");
  citeBox.className = "citemodal";
  citeBox.innerHTML = `
    <div class="citecard">
      <div class="citehd"><span>Cite this work</span><button class="citex" aria-label="close">×</button></div>
      <p class="citenote">Please also credit the underlying data — the Malaysian Election Corpus by Thevesh Thevananthan.</p>
      <div class="citeblock">
        <div class="citelabel">APA <button class="copy" data-k="apa">Copy</button></div>
        <pre>${apa.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>
      </div>
      <div class="citeblock">
        <div class="citelabel">BibTeX <button class="copy" data-k="bib">Copy</button></div>
        <pre>${bib.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>
      </div>
    </div>`;
  document.body.appendChild(citeBox);
  const close = () => { citeBox?.remove(); citeBox = null; };
  citeBox.addEventListener("click", (e) => { if (e.target === citeBox) close(); });
  citeBox.querySelector(".citex")?.addEventListener("click", close);
  citeBox.querySelectorAll<HTMLButtonElement>(".copy").forEach((b) => b.addEventListener("click", async () => {
    const txt = b.dataset.k === "apa" ? apa : bib;
    try { await navigator.clipboard.writeText(txt); showToast("Citation copied"); } catch { showToast("Copy failed — select manually"); }
  }));
}

let rt: any;
addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 150); });

(async () => {
  app.innerHTML = `<div class="loading">Loading indicators…</div>`;
  ROWS = (await fetch(`${BASE}data/indicators.json`).then((r) => r.json())).rows;
  render();
})();
