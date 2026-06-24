import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./style.css";

const BASE = import.meta.env.BASE_URL;
const app = document.getElementById("app")!;

interface Row {
  election: string; year: number; n_seats: number; n_blocs: number;
  enp_votes: number; enp_seats: number; gallagher: number; volatility: number | null;
  turnout: number | null; winner: string; winner_vote_pc: number; winner_seat_pc: number; winner_seat_bonus: number;
}
let ROWS: Row[] = [];

const C = { red: "#b3402f", teal: "#2f6f6b", gold: "#c08a2d", ink: "#16130f", muted: "#6b6256" };

// shared tooltip
const tip = document.createElement("div");
tip.className = "tooltip";
document.body.appendChild(tip);
function showTip(html: string, x: number, y: number) { tip.innerHTML = html; tip.style.opacity = "1"; tip.style.left = Math.min(x + 12, innerWidth - 230) + "px"; tip.style.top = (y - 10) + "px"; }
function hideTip() { tip.style.opacity = "0"; }

interface Series { label: string; color: string; y: (r: Row) => number | null; dashed?: boolean; }
interface ChartOpts { series: Series[]; yMin?: number; yMax?: number; yLabel: string; fmt: (v: number) => string; annotations?: { year: number; text: string }[]; unit?: string; }

function renderChart(host: HTMLElement, o: ChartOpts) {
  const W = Math.max(300, host.clientWidth);
  const H = Math.min(300, Math.max(220, W * 0.52));
  const m = { t: 14, r: 14, b: 26, l: 36 };
  const years = ROWS.map((r) => r.year);
  const xMin = Math.min(...years), xMax = Math.max(...years);
  const all = o.series.flatMap((s) => ROWS.map(s.y).filter((v): v is number => v != null));
  const yMax = o.yMax ?? Math.max(...all) * 1.1;
  const yMin = o.yMin ?? 0;
  const x = (yr: number) => m.l + (yr - xMin) / (xMax - xMin) * (W - m.l - m.r);
  const y = (v: number) => H - m.b - (v - yMin) / (yMax - yMin) * (H - m.t - m.b);

  let g = "";
  // y gridlines
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + (yMax - yMin) * i / ticks;
    const yy = y(v).toFixed(1);
    g += `<line class="gl" x1="${m.l}" y1="${yy}" x2="${W - m.r}" y2="${yy}"/><text class="axt" x="${m.l - 6}" y="${(+yy + 3).toFixed(1)}" text-anchor="end">${o.fmt(v)}</text>`;
  }
  // x labels (every other election to avoid crowding)
  ROWS.forEach((r, i) => { if (i % 2 === 0 || i === ROWS.length - 1) g += `<text class="axt" x="${x(r.year).toFixed(1)}" y="${H - 8}" text-anchor="middle">${String(r.year).slice(2)}</text>`; });
  // annotations
  (o.annotations || []).forEach((a) => {
    const ax = x(a.year);
    g += `<line class="annot" x1="${ax.toFixed(1)}" y1="${m.t}" x2="${ax.toFixed(1)}" y2="${H - m.b}"/><text class="annott" x="${(ax + 4).toFixed(1)}" y="${m.t + 10}">${a.text}</text>`;
  });
  // series
  o.series.forEach((s) => {
    const pts = ROWS.map((r) => ({ r, v: s.y(r) })).filter((p) => p.v != null) as { r: Row; v: number }[];
    const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.r.year).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    g += `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.5" ${s.dashed ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round"/>`;
    g += pts.map((p) => `<circle class="dot" cx="${x(p.r.year).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" fill="${s.color}" data-y="${p.r.year}" data-v="${p.v}" data-l="${s.label}" data-w="${p.r.winner}"/>`).join("");
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

interface Sec { id: string; h2: string; q: string; now: string; nowCap: string; opts: ChartOpts; body: string; formula: string; legend?: { label: string; color: string }[]; }

function sections(): Sec[] {
  const last = ROWS[ROWS.length - 1];
  const fmt1 = (v: number) => v.toFixed(1);
  const fmt2 = (v: number) => v.toFixed(2);
  return [
    {
      id: "disproportionality", h2: "Disproportionality", q: "How faithfully do votes turn into seats?",
      now: last.gallagher.toFixed(1), nowCap: "Gallagher index in 2022 — less than half its 2004 peak of 24.0.",
      opts: { series: [{ label: "Gallagher index", color: C.red, y: (r) => r.gallagher }], yLabel: "Gallagher disproportionality", fmt: fmt1, annotations: [{ year: 2004, text: "BN peak" }, { year: 2018, text: "fall" }] },
      formula: `<b>LSq</b> = √( ½ · Σ (vᵢ − sᵢ)² ) &nbsp; — vᵢ, sᵢ are each bloc's vote &amp; seat share (%).`,
      body: `For half a century Malaysia's first-past-the-post system turned modest vote leads into commanding majorities. Disproportionality peaked at <b>24.0 in 2004</b>, when the ruling coalition converted 64% of the vote into 90% of seats. After 2018 — when no single bloc could dominate — the index roughly halved. A score above ~12 is high by global standards; healthy PR systems sit near 2–5.`,
    },
    {
      id: "seat-bonus", h2: "The winner's bonus", q: "How much does the system inflate the largest bloc?",
      now: (last.winner_seat_bonus >= 0 ? "+" : "") + last.winner_seat_bonus.toFixed(1), nowCap: "percentage-point gap between the winner's seat share and vote share in 2022 — the bonus has vanished.",
      opts: { series: [{ label: "Vote share", color: C.teal, y: (r) => r.winner_vote_pc }, { label: "Seat share", color: C.red, y: (r) => r.winner_seat_pc }], yLabel: "Winner vote vs seat share", fmt: (v) => v.toFixed(0) + "%", yMax: 100, annotations: [{ year: 2013, text: "minority win" }] },
      legend: [{ label: "Winner's vote share", color: C.teal }, { label: "Winner's seat share", color: C.red }],
      body: `The gap between the red line (seats won) and the teal line (votes cast) is the seat bonus FPTP hands the largest bloc. In <b>2013</b> the ruling coalition took 60% of seats on just 47% of the vote — it had actually lost the popular vote. By <b>2022</b> the bonus had vanished (−1.1): for the first time, the largest bloc won a smaller share of seats than of votes, in a hung parliament.`,
      formula: `Seat bonus = winner's seat share − winner's vote share (percentage points).`,
    },
    {
      id: "fragmentation", h2: "Fragmentation", q: "How many parties really matter?",
      now: last.enp_seats.toFixed(1), nowCap: "effective number of parliamentary parties in 2022 — the most fragmented in history.",
      opts: { series: [{ label: "By votes", color: C.gold, y: (r) => r.enp_votes }, { label: "By seats", color: C.red, y: (r) => r.enp_seats }], yLabel: "Effective number of parties", fmt: fmt1, yMax: 4 },
      legend: [{ label: "Effective parties (votes)", color: C.gold }, { label: "Effective parties (seats)", color: C.red }],
      body: `The effective number of parties weights each bloc by its size. Malaysia spent decades as a <b>one-and-a-half-party system</b> (≈1.5 effective parties in the 1950s). It climbed steadily to <b>3.6 by 2022</b> — a genuine three-way contest between PH, PN and BN. Notice the gap: the seats line (red) sat below the votes line (gold) for decades — FPTP squeezing smaller blocs out — until 2022, when the fragmented result closed it.`,
      formula: `<b>N</b> = 1 / Σ pᵢ² &nbsp; (Laakso–Taagepera) — pᵢ is each bloc's share of votes or seats.`,
    },
    {
      id: "volatility", h2: "Volatility", q: "How much does the vote move between elections?",
      now: (last.volatility ?? 0).toFixed(0), nowCap: "Pedersen volatility in 2022 — among the highest ever recorded.",
      opts: { series: [{ label: "Pedersen index", color: C.teal, y: (r) => r.volatility }], yLabel: "Electoral volatility", fmt: fmt1, annotations: [{ year: 2008, text: "tsunami" }, { year: 2022, text: "PN surge" }] },
      body: `Pedersen volatility sums how much each bloc's vote share shifts from one election to the next. The spikes are Malaysia's political earthquakes: <b>1969</b> and <b>1999</b> (Reformasi), the <b>2008</b> "political tsunami", and the <b>2022</b> surge of Perikatan Nasional. Calm stretches (e.g. the early 1980s) mark periods of entrenched dominance.`,
      formula: `<b>V</b> = ½ · Σ |vᵢ,t − vᵢ,t₋₁| &nbsp; — vote-share change per bloc, matched across elections (renames collapsed).`,
    },
    {
      id: "turnout", h2: "Turnout", q: "Do Malaysians show up?",
      now: (last.turnout ?? 0).toFixed(0) + "%", nowCap: "turnout in 2022, the first election with automatic registration and voting at 18.",
      opts: { series: [{ label: "Turnout", color: C.gold, y: (r) => r.turnout }], yLabel: "Voter turnout", fmt: (v) => v.toFixed(0) + "%", yMin: 60, yMax: 90, annotations: [{ year: 2013, text: "record 84%" }] },
      body: `Turnout has stayed remarkably high — between 69% and 84% across seven decades. The record was <b>83.9% in 2013</b>, the most fiercely contested election of the BN era. Turnout dipped in 2022 despite millions of newly-enrolled young voters (Undi18 + automatic registration), a puzzle worth its own study.`,
      formula: `Turnout = ballots cast / registered electors, averaged across all federal contests.`,
    },
    {
      id: "dominance", h2: "The end of the majority party", q: "Is anyone still dominant?",
      now: last.winner_vote_pc.toFixed(0) + "%", nowCap: "the winning bloc's vote share in 2022 — the lowest in Malaysian history.",
      opts: { series: [{ label: "Winner vote share", color: C.red, y: (r) => r.winner_vote_pc }], yLabel: "Winner's vote share", fmt: (v) => v.toFixed(0) + "%", yMax: 90, annotations: [{ year: 2008, text: "2/3 lost" }] },
      body: `The winning coalition's share of the popular vote fell from <b>82% in 1955</b> to <b>38% in 2022</b>. The two-thirds parliamentary supermajority — the constitutional threshold — was lost for good in 2008. Malaysia has moved decisively from a dominant-party system to competitive, coalition-by-coalition politics.`,
      formula: `Share of all valid federal votes won by the bloc that took the most seats.`,
    },
  ];
}

function render() {
  const secs = sections();
  app.innerHTML = `
  <header class="hero"><div class="wrap">
    <div class="kicker">Nadi Demokrasi · The Pulse of Democracy</div>
    <h1>Malaysia's democracy,<br>in numbers</h1>
    <p class="dek">Seven decades of general elections measured with the standard tools of political science — disproportionality, fragmentation, volatility and turnout.</p>
    <div class="meta">16 federal general elections · 1955–2022 · reproducible &amp; citable</div>
  </div></header>
  <div class="wrap">
    <div class="lede">
      <p>Numbers don't capture everything about a democracy — but a handful of well-defined indices, computed the same way every election, reveal the deep shifts that headlines miss. Here are six, drawn from the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a>, each with its formula and its full history.</p>
    </div>
    ${secs.map((s) => `
      <section class="ind" id="${s.id}">
        <h2>${s.h2}</h2>
        <div class="q">${s.q}</div>
        <div class="bignow"><span class="v">${s.now}</span><span class="cap">${s.nowCap}</span></div>
        ${s.legend ? `<div class="legendrow">${s.legend.map((l) => `<span><i style="background:${l.color}"></i>${l.label}</span>`).join("")}</div>` : ""}
        <div class="chartbox"><div class="chart" data-sec="${s.id}"></div></div>
        <p class="body">${s.body}</p>
        <div class="formula">${s.formula}</div>
      </section>`).join("")}

    <div class="method">
      <h2 class="sans">Method &amp; reproducibility</h2>
      <p>Every figure here is computed from official results by one short, open script. The unit of analysis is each election's <b>blocs</b>: a candidate's coalition where they ran in one, otherwise their party (so non-aligned parties are their own bloc; independents share one). Vote shares use valid votes; seat shares use the 222→ federal seats of each election.</p>
      <h3 class="sans">Caveats</h3>
      <ul>
        <li>Indicators are computed at federal general elections only (state elections and by-elections excluded).</li>
        <li>Volatility (Pedersen) matches blocs across elections with pure <i>renames</i> collapsed (PERIKATAN→BN, BA→PR→PH), so relabelling isn't counted as churn; genuine splits and mergers still register.</li>
        <li>Bloc choice affects the effective-number-of-parties and Gallagher figures; we use coalitions because that is how Malaysian government forms.</li>
      </ul>
      <div class="dl">
        <a href="${BASE}data/indicators.csv" download>↓ Download indicators.csv</a>
        <a href="${BASE}data/indicators.json" download>↓ indicators.json</a>
        <a href="https://github.com/zachtheyek/nadi-demokrasi" target="_blank" rel="noopener">Source &amp; formulae →</a>
      </div>
    </div>
    <footer>
      Built on the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> by Thevesh Thevananthan (CC0), peer-reviewed in <i>Scientific Data</i> 13, 190 (2026). Not affiliated with the author. Indicators follow Laakso–Taagepera (1979), Gallagher (1991) and Pedersen (1979).
    </footer>
  </div>`;
  secs.forEach((s) => renderChart(app.querySelector(`[data-sec="${s.id}"]`)!, s.opts));
}

let rt: any;
addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 150); });

(async () => {
  app.innerHTML = `<div class="loading">Loading indicators…</div>`;
  ROWS = (await fetch(`${BASE}data/indicators.json`).then((r) => r.json())).rows;
  render();
})();
