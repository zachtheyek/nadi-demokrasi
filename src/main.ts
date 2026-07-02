import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "katex/dist/katex.min.css";
import katex from "katex";
import "./style.css";
// the chart engine + section specs are shared with the OG-card prerenderer so a shared-on-X card
// looks exactly like the page (same annotations, headings, summaries) — see src/chartkit.mjs
import { buildSpecs, chartSVG } from "./chartkit.mjs";

const BASE = import.meta.env.BASE_URL;
const SITE = location.origin + BASE;
const ORCID = "0000-0002-2532-4883";
// the X (formerly Twitter) wordmark, used in place of the letter "X" on share buttons
const X_ICON = `<svg class="xlogo" viewBox="0 0 24 24" aria-label="X" role="img"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
const GH_ICON = `<svg class="ghlogo" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
// link (chain) icon for the per-section "copy link" anchor
const LINK_ICON = `<svg class="linkico" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25Zm-4.69 9.64a2 2 0 0 1 0-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 0 1-2.83 0Z"/></svg>`;
const app = document.getElementById("app")!;

interface Bloc { label: string; seats: number; seat_pc: number; }
interface Row {
  election: string; year: number; n_seats: number; n_blocs: number;
  enp_votes: number; enp_seats: number; gallagher: number; malapportionment: number | null;
  map_bias: number | null; compactness: number | null;
  volatility: number | null; turnover: number | null; turnout: number | null;
  women_pc: number; cand_per_seat: number; three_plus_pc: number; marginal_pc: number;
  malay_pc: number; chinese_pc: number; indian_pc: number; em_bumi_pc: number;
  winner: string; winner_vote_pc: number; winner_seat_pc: number; winner_seat_bonus: number;
  top_blocs: Bloc[];
}
let ROWS: Row[] = [];

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
// dismiss the info card the moment the reader starts scrolling (mobile taps otherwise leave it stuck)
addEventListener("scroll", () => { if (tip.style.opacity === "1") { hideTip(); document.querySelectorAll(".hoverdots").forEach((h) => (h.innerHTML = "")); } }, { passive: true });

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
interface PointC { year: number; value: number; tag: string; place?: "above" | "below" | "left" | "right"; hi?: string; hiColor?: string; }
interface YRef { at: number; to?: number; label: string; label2?: string; side?: "left" | "right"; xTo?: number; labelAt?: { year: number; value: number }; }
interface XBand { from: number; to: number; label?: string; fill?: string; }
interface XLine { year: number; label: string; }
interface GapC { year: number; label: string; }
interface ChartOpts {
  series: Series[];
  yMin?: number; yMax?: number; yLabel: string;
  fmt: (v: number) => string; unit?: string;
  points?: PointC[]; yRefs?: YRef[]; xBands?: XBand[]; xLines?: XLine[];
  gapFill?: boolean; gap?: GapC;
}

// Fixed design size — the chart is always drawn at the desktop width and scaled to fit its box via
// the SVG viewBox (CSS width:100%; height:auto). This keeps annotation spacing/de-collision identical
// on every device (desktop stays pixel-for-pixel; narrow/vertical-mobile just renders the same chart
// smaller, instead of re-laying-out into a compressed, colliding mess).
const CHART_W = 688, CHART_H = 310;
function renderChart(host: HTMLElement, o: ChartOpts) {
  const { g, x, y } = chartSVG(ROWS, o, CHART_W, CHART_H);
  host.innerHTML = `<svg viewBox="0 0 ${CHART_W} ${CHART_H}" role="img" aria-label="${o.yLabel}">${g}<g class="hoverdots"></g></svg>`;
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
      // document-space coords (pageX/pageY) so the absolute tip lands by the point even when zoomed
      const t = ev.touches ? ev.touches[0] : ev;
      showAt(+el.dataset.y!, t.pageX, t.pageY);
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

  // Derivations the prose needs. (Values used only by the chart opts/headings are derived once, in
  // chartkit's buildSpecs — the shared source of truth — so they are not repeated here.)
  const gPeak = arg("gallagher", 1);
  const mPeak = arg("malapportionment", 1), mLow = arg("malapportionment", -1);
  const mbPeak = arg("map_bias", 1);
  const cPeak = arg("compactness", 1), cLow = arg("compactness", -1);
  const bPeak = arg("winner_seat_bonus", 1);
  const minorityWins = ROWS.filter((r) => r.winner_vote_pc < 50 && r.winner_seat_pc > 50);
  const minRecent = minorityWins.length ? minorityWins[minorityWins.length - 1].year : null;
  const bNow = L.winner_seat_bonus;
  const firstNeg = ROWS.filter((r) => r.winner_seat_bonus < 0)[0];
  const isFirstNeg = !!firstNeg && firstNeg.year === L.year;
  const hung = !L.top_blocs.some((b) => b.seat_pc > 50);
  const enpPeak = arg("enp_seats", 1), enpLow = arg("enp_seats", -1);
  const volRanked = ROWS.filter((r) => r.volatility != null).sort((a, b) => (b.volatility! - a.volatility!));
  const volTop = volRanked.slice(0, 3);
  const volDips = volRanked.slice(-2);   // the two calmest elections
  const r2008 = at(2008);
  const tPeak = arg("turnout", 1), tLow = arg("turnout", -1);
  const tPrev = ROWS[ROWS.length - 2];
  const tDrop = (tPrev.turnout != null && L.turnout != null) ? (tPrev.turnout - L.turnout) : 0;
  // "lost for good": the election after the LAST one where the winner held a two-thirds seat share
  let lastAbove = -1;
  ROWS.forEach((r, i) => { if (r.winner_seat_pc >= 200 / 3) lastAbove = i; });
  const twoThirdsYr = (lastAbove >= 0 && lastAbove < ROWS.length - 1) ? ROWS[lastAbove + 1].year : null;
  const big3 = L.top_blocs.slice(0, 3);
  const candLow = arg("cand_per_seat", -1);
  const margPeak = arg("marginal_pc", 1);
  const wPeak = arg("women_pc", 1);
  const toPeak = arg("turnover", 1);

  const hl = (s: string) => `<span class="hl">${s}</span>`;
  const hlt = (s: string) => `<span class="hl-t">${s}</span>`;
  const hlg = (s: string) => `<span class="hl-g">${s}</span>`;
  const hls = (s: string) => `<span class="hl-s">${s}</span>`;

  // Headings + chart opts come from the shared buildSpecs() (also used by the OG-card prerenderer),
  // so the page and the shared-on-X cards are guaranteed identical. Only the prose lives here.
  const prose: Record<string, { body: string; note?: string; method: Method }> = {
    /* 1 ─ the total gap */
    "disproportionality": {
      body: `The Gallagher index — a single measure of how far a parliament's seats stray from the votes cast — peaked at ${hl(num(gPeak.gallagher, 1) + " in " + gPeak.year)}, when the winning bloc (${gPeak.winner}) turned ${hlt(num(gPeak.winner_vote_pc) + "%")} of the vote into ${hlt(num(gPeak.winner_seat_pc) + "%")} of seats. By ${L.year} it had fallen to ${hl(num(L.gallagher, 1))} — the closest Malaysia's seats have come to matching its votes. A score above 12 is high by world standards; established proportional systems sit near 2–5.`,
      note: `This is the <em>total</em> gap between votes and seats. It has two sources — an electoral system that rewards the largest bloc (see <a href="#seat-bonus">the winner's bonus</a>) and electoral districts drawn to hold very different numbers of voters, so a vote in one seat can weigh far more than a vote in another (see <a href="#malapportionment">malapportionment</a>). The next two sections measure each in turn.`,
      method: {
        eq: String.raw`\mathrm{LSq} = \sqrt{\tfrac{1}{2} \textstyle\sum_i (v_i - s_i)^2}`,
        where: `<strong>v<sub>i</sub></strong> and <strong>s<sub>i</sub></strong> are bloc <em>i</em>'s share of the valid vote and of seats, in percentage points. A perfectly proportional result — every bloc's seat share equal to its vote share — scores 0; the bigger the score, the larger the gap between votes cast and seats won.`,
      },
    },
    /* 2 ─ one source: the winner's mechanical reward */
    "seat-bonus": {
      body: `The gap between the winner's seats (red) and votes (teal) is the bonus first-past-the-post hands the largest bloc. It peaked at ${hlt("+" + num(bPeak.winner_seat_bonus, 1) + " points in " + bPeak.year)}, when ${bPeak.winner} turned ${hlt(num(bPeak.winner_vote_pc) + "%")} of votes into ${hl(num(bPeak.winner_seat_pc) + "%")} of seats.${minRecent ? ` On ${minorityWins.length === 1 ? "one occasion" : minorityWins.length + " occasions"} the largest bloc even won a majority of seats on a ${hlt("minority of the vote")} — most recently in ${minRecent}.` : ""} By ${L.year}, ${bNow < -0.5 ? `the gap has vanished (${hlt(num(bNow, 1))})` : Math.abs(bNow) <= 2 ? `the gap has all but vanished (${hlt(num(bNow, 1))})` : `the gap stands at ${hlt(num(bNow, 1))}`}${isFirstNeg ? `: for the first time, the largest bloc held a smaller share of seats than of votes` : ""}${hung ? `, in a hung parliament` : ""}.`,
      method: {
        eq: String.raw`B = s_w - v_w`,
        where: `<strong>s<sub>w</sub></strong> and <strong>v<sub>w</sub></strong> are the winning bloc's share of seats and of the valid vote (%). A positive <em>B</em> means the system magnified the leader into a bigger parliamentary presence than its votes alone would justify; a negative <em>B</em> means it under-rewarded them.`,
      },
    },
    /* 3 ─ the other source: unequal districts */
    "malapportionment": {
      body: `Every seat elects one MP, but seats hold wildly unequal numbers of voters — a rural seat can have a fraction of an urban one's electorate, so a rural vote counts for more. The Samuels–Snyder index gives the share of seats that would have to be reallocated to equalise voters per seat. Malaysia's has climbed to ${hl(num(mPeak.malapportionment ?? 0, 1) + "% in " + mPeak.year)}, from a low of ${hl(num(mLow.malapportionment ?? 0, 1) + "% in " + mLow.year)}. Anything above a few percent is high; ${hl("above ~15% is among the most malapportioned in the democratic world")}. This is a <em>structural</em> distortion, separate from <a href="#seat-bonus">the winner's bonus</a> — and unlike that bonus, it has not gone away.`,
      note: `Malapportionment — unequal district sizes — is one of two ways boundaries can distort an election; the other is <em>gerrymandering</em>, drawing the shapes to pack or split a party's voters, which this index does not measure — the next two sections take that up (<a href="#map-bias">who the map favours</a> and <a href="#compactness">district shapes</a>). Both are baked into where the lines are drawn, so they persist across changes of government — a large part of why <a href="#disproportionality">disproportionality</a> stayed high even as <a href="#seat-bonus">the winner's bonus</a> collapsed.`,
      method: {
        eq: String.raw`\mathrm{MAL} = \tfrac{1}{2} \textstyle\sum_i \left\lvert \dfrac{1}{n} - \dfrac{e_i}{E} \right\rvert`,
        where: `<strong>n</strong> is the number of seats, <strong>e<sub>i</sub></strong> the registered electors in seat <em>i</em>, and <strong>E</strong> the total electorate. Each seat carries an equal 1 / n of the seats but an unequal e<sub>i</sub> / E of the voters; the index sums those gaps and halves them — the fraction of seats "in the wrong place" under one-person-one-vote.`,
      },
    },
    /* 4 ─ the other source: who the unequal map favours */
    "map-bias": {
      body: `For most of Malaysia's history the unequal map barely tilted the outcome — the winning bloc's seats were about the size of everyone else's. Then it mattered: in ${hlt(String(mbPeak.year))} the winning bloc (${mbPeak.winner}) held seats ${hl(num(Math.abs(mbPeak.map_bias ?? 0), 0) + "% smaller")} than the average, sweeping small rural seats while trailing in the big urban ones. ${(L.map_bias ?? 0) < 0 ? `Since then the tilt has flipped: by ${L.year} the winning bloc's seats held ${hl(num(Math.abs(L.map_bias ?? 0), 0) + "% more voters")} than average — so the same rural-weighted map now works against whoever wins the popular vote.` : `By ${L.year} the winner's seats still ran ${hl(num(Math.abs(L.map_bias ?? 0), 0) + "% smaller")} than average — the map still favours it.`}`,
      note: `This is one honest way to ask <em>who</em> the unequal map favours — using only electorate sizes and who won each seat. It measures the effect of unequal district <em>sizes</em> (<a href="#malapportionment">malapportionment</a>), not the drawing of district <em>shapes</em> — that comes <a href="#compactness">next</a>. The other standard "who benefits" measures — the efficiency gap and partisan bias — assume a two-party contest Malaysia does not have; see <a href="#limitations">Method &amp; limitations</a>.`,
      method: {
        eq: String.raw`\beta = 100 \cdot \dfrac{\bar{e} - \bar{e}_w}{\bar{e}}`,
        where: `<strong>ē</strong> is the mean electorate of all seats and <strong>ē<sub>w</sub></strong> the mean electorate of the seats the winning bloc took. A positive <em>β</em> means the winner's seats are smaller than average — over-represented, so the malapportioned map worked in its favour; a negative <em>β</em> means it won while sitting in the larger, under-weighted seats. It needs only electors and the winner, so unlike the efficiency gap it makes no two-party assumption.`,
      },
    },
    /* 5 ─ the shape of the lines */
    "compactness": {
      body: `A seat's Polsby–Popper score compares its area to a circle of the same perimeter — ${hl("1 is a perfect circle")}, and lower means a more irregular, sprawling or tentacled outline. Malaysia's seats were at their most compact — an average of ${hl(num(cPeak.compactness ?? 0, 2))} — decades ago; the most recent redelineation has left them the ${hl("least compact on record")}, at ${hl(num(cLow.compactness ?? 0, 2) + " in " + cLow.year)}.`,
      note: `Irregular shapes are a <em>signal</em>, not proof of intent: coastlines, rivers and the scatter of East Malaysia push compactness down for reasons that have nothing to do with drawing an advantage. Read it with <a href="#malapportionment">malapportionment</a> and <a href="#map-bias">who the map favours</a> — together they describe how the lines are drawn; none alone proves why.`,
      method: {
        eq: String.raw`\mathrm{PP} = \dfrac{4\pi A}{P^2}`,
        where: `<strong>A</strong> is a seat's area and <strong>P</strong> its perimeter; the score is 1 for a perfect circle and falls toward 0 as the outline grows longer and more contorted for the area it encloses. We average it over all federal seats in each delimitation, measured on the boundary maps. A falling line means the newest boundaries are less compact than the ones they replaced.`,
      },
    },
    /* 6 ─ the winner's grip, over time */
    "dominance": {
      body: `The winning coalition's share of the popular vote has fallen from ${hl(num(F.winner_vote_pc) + "% in " + F.year)} to ${hl(num(L.winner_vote_pc) + "% in " + L.year)} — the lowest in our history.${twoThirdsYr ? ` The two-thirds parliamentary supermajority, long the benchmark of dominance, was lost for good after ${hlt(String(twoThirdsYr))}.` : ""} Malaysia has moved decisively from a dominant-party system to competitive, coalition-by-coalition politics.`,
      method: {
        text: `The "winner" is the bloc that took the most seats; the line is its share of all valid federal votes cast that year. Read it alongside <a href="#fragmentation">fragmentation</a> below: a falling winner's share and a rising effective number of parties are two views of the same shift to multi-bloc competition.`,
      },
    },
    /* 5 ─ how many blocs matter */
    "fragmentation": {
      body: `The effective number of parties weights each bloc by its size, so a few dominant blocs count for less than many even ones. Malaysia spent decades as a ${hlt("one-and-a-half-party system")} — about ${hlg(num(F.enp_votes, 1))} effective parties by votes in ${hlg(String(F.year))}, bottoming at ${hl(num(enpLow.enp_seats, 1))} in parliament in ${hl(String(enpLow.year))}. It has since climbed to ${hl(num(enpPeak.enp_seats, 1) + " by " + enpPeak.year)}, a genuine multi-way contest between its three biggest blocs — ${big3.map((b) => hlt(b.label)).join(", ").replace(/, ([^,]*)$/, " and $1")}. For decades the seats line sat below the votes line — first-past-the-post squeezing smaller blocs out of parliament — until ${enpPeak.year}, when a fragmented result closed the gap.`,
      method: {
        eq: String.raw`N = \dfrac{1}{\sum_i p_i^{\,2}}`,
        where: `<strong>p<sub>i</sub></strong> is bloc <em>i</em>'s share — of votes for the votes line, of seats for the seats line. Two equally-sized blocs give N = 2; one dominant bloc pulls N toward 1. It is the Laakso–Taagepera index, a standard count of "parties that matter".`,
      },
    },
    /* 6 ─ how many contenders per seat */
    "multi-cornered": {
      body: `For most of Malaysia's history a seat was a straight fight — about ${hl(num(F.cand_per_seat, 1))} candidates on the ballot. As the two-coalition system hardened, contests narrowed to a low of ${hl(num(candLow.cand_per_seat, 1) + " in " + candLow.year)}. Then they splintered: by ${L.year} the average seat drew ${hl(num(L.cand_per_seat, 1) + " candidates")}, and ${hlt(num(L.three_plus_pc) + "% were three-cornered or more")}. Multi-cornered fights are how a bloc can win a seat on a minority of the vote — much of the machinery behind the <a href="#disproportionality">disproportionality</a> above.`,
      method: {
        eq: String.raw`\bar{c} = \dfrac{1}{n} \textstyle\sum_i c_i`,
        where: `<strong>c<sub>i</sub></strong> is the number of candidates contesting seat <em>i</em> and <strong>n</strong> the number of seats — so the figure is simply the <em>mean</em> candidates per seat. Read it with <a href="#fragmentation">fragmentation</a>: more blocs mean more names on the ballot and more three-way splits, which under first-past-the-post let winners take seats with well under half the vote.`,
      },
    },
    /* 7 ─ how much the vote moves */
    "volatility": {
      body: `Pedersen volatility sums how much each bloc's vote share shifts from one election to the next. The largest realignments by this measure came in ${hl(volTop.map((r) => r.year).sort((a, b) => a - b).join(", "))} — each a wholesale redrawing of who voted for whom. The calmest elections — ${volDips.slice().sort((a, b) => a.year - b.year).map((r) => hl(String(r.year))).join(" and ")} — were near-repeat contests, where little support moved between blocs.`,
      note: r2008 ? `A caution on reading this chart: the ${r2008.year} "political tsunami" — when the ruling coalition lost its two-thirds majority — barely registers here (${hl(num(r2008.volatility ?? 0))}). That shock was about <em>seats</em>, not vote share: BN still won ${hl(num(r2008.winner_vote_pc) + "%")} of the vote, so relatively little support actually moved between blocs. Vote volatility and seat change can tell very different stories.` : undefined,
      method: {
        eq: String.raw`V = \tfrac{1}{2} \textstyle\sum_i \lvert v_{i,t} - v_{i,t-1} \rvert`,
        where: `<strong>v<sub>i,t</sub></strong> is bloc <em>i</em>'s vote share at election <em>t</em>. Blocs are matched across elections with pure renames collapsed (PERIKATAN→BN, BA→PR→PH), so relabelling is not counted as change — but genuine splits and mergers are. The first election has no prior to compare against, so its value is null.`,
      },
    },
    /* 8 ─ how many seats change hands */
    "turnover": {
      body: `A seat "flips" when a different coalition wins it. Turnover peaked at ${hl(num(toPeak.turnover ?? 0) + "% in " + toPeak.year)} — more than half the House changed hands as ${hlt("PN surged")} and ${hlt("BN collapsed")}. Tellingly, the ${hl(num((at(2008)?.turnover) ?? 0) + "% turnover of 2008")} dwarfs that year's modest ${hlt("vote volatility")}: seats can change hands without much of the vote actually moving.`,
      note: `Seats are threaded across delimitations by boundary-based lineage (see <a href="#malapportionment">malapportionment</a>); where a redrawing split or merged seats, the flip is measured against the dominant ancestor, so turnover in redelineation years is approximate. Read it alongside <a href="#volatility">volatility</a> above — vote movement and seat movement are not the same.`,
      method: {
        eq: String.raw`F = \dfrac{\lvert\{\, i : b_i^{\,t} \ne b_i^{\,t-1} \,\}\rvert}{n}`,
        where: `<strong>b<sub>i</sub><sup>t</sup></strong> is the winning bloc of seat <em>i</em> at election <em>t</em> (renames collapsed, so a rebrand is not a flip), and <strong>n</strong> the seats present at both elections. Seats are matched across boundary changes by their lineage, so the count threads through Malaysia's redelineations.`,
      },
    },
    /* 9 ─ how close the contests are */
    "marginal": {
      body: `A marginal seat — won by less than five percentage points — is where an election actually turns. Malaysia's map was long dominated by safe seats, but contestability has risen sharply: marginals peaked at ${hl(num(margPeak.marginal_pc, 1) + "% in " + margPeak.year)} and stood at ${hl(num(L.marginal_pc, 1) + "% in " + L.year)} — about ${hlt("one in " + Math.round(100 / L.marginal_pc) + " seats")} decided on a knife-edge.`,
      note: `A small margin can mean two different things: a genuine two-way cliffhanger, or a multi-cornered split that hands a bloc the seat on a thin plurality. Read this alongside <a href="#multi-cornered">multi-cornered contests</a> above.`,
      method: {
        eq: String.raw`m = \dfrac{\lvert\{\, i : d_i < 5 \,\}\rvert}{n}`,
        where: `<strong>d<sub>i</sub></strong> is the winning margin in seat <em>i</em> — the winner's lead over the runner-up, in percentage points of the valid vote — and <strong>n</strong> is the number of seats. So <em>m</em> is the share of seats decided by under 5 points. Uncontested seats have no margin and count as safe, which they are.`,
      },
    },
    /* 10 ─ do people show up */
    "turnout": {
      body: `Turnout has stayed high — between ${hl(num(tLow.turnout ?? 0) + "% and " + num(tPeak.turnout ?? 0) + "%")} across seven decades. The peak was ${hl(num(tPeak.turnout ?? 0) + "% in " + tPeak.year)}, the most fiercely contested election of the BN era. It then fell to ${hl(num(L.turnout ?? 0) + "%")} in ${L.year}, a drop of ${hl(num(tDrop, 1) + " points")} from ${tPrev.year}, despite millions of newly-enrolled young voters under automatic registration and Undi18 — a puzzle worth its own study.`,
      method: {
        eq: String.raw`T = \dfrac{1}{n} \textstyle\sum_c \dfrac{b_c}{e_c}`,
        where: `for each seat <em>c</em>, <strong>b<sub>c</sub></strong> is ballots cast and <strong>e<sub>c</sub></strong> registered electors; <strong>n</strong> is the number of seats. The denominator is <em>registered</em> voters — so before automatic registration in 2021, ${hlt("older figures overstate participation among the voting-age population")}, because many eligible adults were never on the roll.`,
      },
    },
    /* 11 ─ who actually gets elected */
    "women": {
      body: `The people's house has never resembled the people who elect it. Women held just ${hl(num(F.women_pc, 1) + "% of seats in " + F.year)}; the share climbed to a peak of ${hl(num(wPeak.women_pc, 1) + "% in " + wPeak.year)}, then eased to ${hl(num(L.women_pc, 1) + "% in " + L.year)}. That leaves Parliament far below the ${hlt("~30%")} many democracies treat as a floor — and further still from the half of the population women make up.`,
      note: `This is <em>descriptive</em> representation — who sits in the chamber — not how they vote or whom they serve. Read it alongside <a href="#ethnicity">Parliament's ethnic makeup</a> below.`,
      method: {
        eq: String.raw`w = \dfrac{W}{n}`,
        where: `<strong>W</strong> is the number of elected women MPs and <strong>n</strong> the total number of seats, so <em>w</em> is simply the share of the winning benches who are women — the single clearest check on how much Parliament resembles the electorate. Read it alongside <a href="#ethnicity">Parliament's ethnic makeup</a> below.`,
      },
    },
    /* 12 ─ who the winners are, by community */
    "ethnicity": {
      body: `Parliament's benches have always been mostly Malay, but their exact ethnic mix has shifted. The share of ${hl("ethnic-Chinese MPs")} has fallen from about ${hl(num(F.chinese_pc) + "% in " + F.year)} to ${hl(num(L.chinese_pc) + "% in " + L.year)}, while ${hlt("Malay MPs")} rose to ${hlt(num(L.malay_pc) + "%")}. Since Sabah and Sarawak joined in the 1960s, their ${hlg("Bumiputera communities")} have held a steady share of about ${hlg(num(L.em_bumi_pc) + "%")}, and ${hls("Indian MPs")} have remained a small presence throughout.`,
      note: `This is <em>descriptive</em> representation — who sits in the chamber — not how they vote or whom they serve. Read it alongside <a href="#women">women in Parliament</a> above.`,
      method: {
        eq: String.raw`g_j = \dfrac{G_j}{n}`,
        where: `<strong>G<sub>j</sub></strong> is the number of elected MPs in ethnic group <em>j</em> — Malay, Chinese, the Bumiputera communities of Sabah and Sarawak, and Indian — and <strong>n</strong> the total number of seats, so <em>g<sub>j</sub></em> is each group's share of the chamber. A descriptive count of who sits. Read it alongside <a href="#women">women in Parliament</a> above.`,
      },
    },
  };
  return (buildSpecs(ROWS) as Omit<Sec, "body" | "note" | "method">[]).map((s) => ({ ...s, ...prose[s.id] }));
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
    <p class="dek">Seven decades of general elections measured with the standard tools of political science — disproportionality, fragmentation, volatility, turnout, and representation.</p>
    <div class="meta">${ROWS.length} federal general elections · ${F.year}–${L.year} · reproducible &amp; citable</div>
    <div class="herobtns">
      <button class="btn" id="shareBtn">${X_ICON} Share</button>
      <a class="btn" href="${BASE}data/nadi-demokrasi-data.zip" download><span class="bico">↓</span>Data</a>
      <a class="btn" href="https://github.com/zachtheyek/nadi-demokrasi" target="_blank" rel="noopener">${GH_ICON} Source</a>
      <button class="btn" id="citeBtn"><span class="bico">❝</span>Cite</button>
    </div>
  </div></header>
  <div class="wrap">
    <div class="lede">
      <p>Numbers don't capture everything about a democracy — but a handful of well-defined indices, each measured the same way at every election, reveal the deep shifts that headlines miss. Here are ${secs.length}, drawn from the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> — each revealing a different dimension of the health of Malaysia's political system.</p>
    </div>
    ${secs.map((s, i) => `
      <section class="ind" id="${s.id}">
        <div class="ind-head">
          <a class="anchor" href="#${s.id}" data-link="${s.id}" title="Copy link to this section" aria-label="Copy link to this section">${LINK_ICON}</a>
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
      <div class="mhead"><a class="anchor" href="#limitations" data-link="limitations" title="Copy link to this section" aria-label="Copy link to this section">${LINK_ICON}</a><h2 class="sans">Method &amp; limitations</h2></div>
      <p>Every figure here is computed from official results by one short, open script. The unit of analysis is each election's <b>blocs</b>: a candidate's coalition where they ran in one, otherwise their party (so non-aligned parties are their own bloc; independents share one). Vote shares use valid votes; seat shares use the federal seats of each election — a number that itself grew from ${F.n_seats} in ${F.year} to ${L.n_seats} in ${L.year} as the country and its parliament expanded.</p>
      <h3 class="sans">What these indicators do <em>not</em> capture</h3>
      <ul>
        <li><b>Gallagher bundles both distortions.</b> The <a href="#disproportionality">disproportionality</a> score reports the <em>total</em> vote-to-seat gap; the <a href="#seat-bonus">winner's bonus</a> and <a href="#malapportionment">malapportionment</a> are shown separately, but the corpus does not let us cleanly attribute every point of Gallagher to one or the other.</li>
        <li><b>The gerrymandering question, partly answered.</b> Two ways boundaries can distort a result: unequal district <em>sizes</em> — <a href="#malapportionment">malapportionment</a> and <a href="#map-bias">who it favours</a> — and irregular district <em>shapes</em> — <a href="#compactness">compactness</a>. The other standard partisan-symmetry measures: the <em>efficiency gap</em> (how lopsidedly each side's votes are "wasted", as a share of all votes cast) and <em>partisan bias</em> (the seat-share gap the two sides would win at an identical 50% vote), are excluded from this analysis. Both are defined for <em>two-party</em> competition; Malaysia is multi-bloc and largely multi-cornered, so there is no clean two-side split of wasted votes, nor a clean 50/50 counterfactual — forcing one would discard the very reality shown above.</li>
        <li><b>Bloc definition is a choice.</b> <a href="#fragmentation">Effective-parties</a> and <a href="#disproportionality">Gallagher</a> figures depend on counting coalitions as the unit rather than individual parties; we use coalitions because that is how Malaysian governments form, but a party-level reading would give higher fragmentation and different disproportionality.</li>
        <li><b>Vote volatility ≠ seat upheaval.</b> <a href="#volatility">Pedersen volatility</a> tracks how much <em>vote share</em> moves between blocs; <a href="#turnover">seat turnover</a> tracks how many seats change hands. They diverge — 2008 flipped many seats on modest vote movement — so read the two together rather than one or the other.</li>
        <li><b>Seat turnover is threaded, not exact.</b> Because seat boundaries are redrawn periodically, <a href="#turnover">turnover</a> matches each seat to its dominant boundary ancestor (<a href="https://electiondata.my" target="_blank" rel="noopener">electiondata.my</a> lineage); in redelineation years, where seats split or merge, the flip count is approximate.</li>
        <li><b>Uncontested seats and the turnout denominator.</b> Early elections had many uncontested seats (counted as won, with no <a href="#turnout">turnout</a>), and turnout uses <em>registered</em> electors — so pre-2021 turnout overstates participation among all eligible adults, before automatic registration put everyone on the roll. Turnout <em>by age</em> would need the individual voter rolls, not this corpus — see <a href="https://zachtheyek.github.io/undi-generasi/" target="_blank" rel="noopener">Undi Generasi</a> for the generational breakdown.</li>
        <li><b>Representation is descriptive, not substantive.</b> <a href="#women">Women's</a> and <a href="#ethnicity">ethnic makeup</a> count <em>who sits</em>, not how they vote or whom they serve; ethnic makeup also reflects the electorate's own composition and where seats are drawn, not a verdict on any community.</li>
        <li><b>Coalition continuity in East Malaysia.</b> Sabah and Sarawak parties have shifted between federal coalitions repeatedly; the rename-collapsing rule handles clean successions but cannot perfectly track fluid, partial realignments.</li>
        <li><b>Federal general elections only.</b> State elections, by-elections, and the timing differences for Sabah (joined 1963) and Sarawak (first federal vote 1969) are excluded; this is a federal-parliament story, not a complete account of every ballot cast.</li>
      </ul>
      <div class="dl">
        <button class="citelink" id="shareBtn2">${X_ICON} Share</button>
        <a href="${BASE}data/nadi-demokrasi-data.zip" download><span class="bico">↓</span>Data</a>
        <a href="https://github.com/zachtheyek/nadi-demokrasi" target="_blank" rel="noopener">${GH_ICON} Source</a>
        <button class="citelink" id="citeBtn2"><span class="bico">❝</span>Cite</button>
      </div>
    </div>
    <footer>
      Built on the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> by <a href="https://x.com/Thevesh" target="_blank" rel="noopener">Thevesh Thevananthan</a> (CC0), peer-reviewed in <i>Scientific Data</i> 13, 190 (2026). Not affiliated with the author. Indicators follow Laakso–Taagepera (1979), Gallagher (1991), Pedersen (1979), Samuels–Snyder (2001) and Polsby–Popper (1991).
    </footer>
  </div>`;

  secs.forEach((s) => renderChart(app.querySelector(`[data-sec="${s.id}"]`)!, s.opts));
  document.getElementById("citeBtn")?.addEventListener("click", openCite);
  document.getElementById("citeBtn2")?.addEventListener("click", openCite);
  const shareAll = () => shareOnX(`When was the last time you checked in on the health of your democracy?\n\nNadi Demokrasi analyzes ${ROWS.length} general elections (${F.year}–${L.year}) using ${secs.length} political-science indicators — measuring disproportionality, fragmentation, volatility, turnout, and representation — in a single intuitive dashboard.\n\nEvery formula listed, every number reproducible.\n\n${SITE}?v=6`);
  document.getElementById("shareBtn")?.addEventListener("click", shareAll);
  document.getElementById("shareBtn2")?.addEventListener("click", shareAll);
  // per-section copy-link + X share. Clicking the anchor only tags the URL with the section and
  // copies the link — it does NOT scroll (so it can't fight the reader's own scrolling).
  app.querySelectorAll<HTMLElement>(".anchor").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const id = a.dataset.link!;
    history.replaceState(null, "", "#" + id);
    copy(SITE + "#" + id, "Section link copied");
  }));
  app.querySelectorAll<HTMLElement>(".sharex").forEach((b) => b.addEventListener("click", () => {
    const s = secs.find((x) => x.id === b.dataset.share)!;
    // headline question, then the summary, then the section's /s/ page (its OG image is this section's
    // plot, and it redirects to the section) — so the tweet embeds the matching chart card
    shareOnX(`${s.q}\n\n${s.share} — via Nadi Demokrasi.\n\n${SITE}s/${s.id}/`);
  }));
  // deep-link on load (content is fetched async, so scroll after render)
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) setTimeout(() => el.scrollIntoView(), 40); }
}

function shareOnX(text: string) {
  // the URL is embedded in the text (so we control its placement after a blank line); X unfurls it
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener");
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

// No resize re-render: charts scale via the SVG viewBox and the layout is CSS-responsive, so a
// full re-render on resize is unnecessary — and on mobile it fired on every address-bar show/hide,
// re-running the deep-link scroll (snapping back to a jumped section) and eating taps mid-render.

(async () => {
  app.innerHTML = `<div class="loading">Loading indicators…</div>`;
  ROWS = (await fetch(`${BASE}data/indicators.json`).then((r) => r.json())).rows;
  render();
})();
