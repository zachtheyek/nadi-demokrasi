# Nadi Demokrasi — maintainer context

Everything a person or agent needs to pick up this dashboard and keep improving it. This is the
long-form companion to the lean [`CLAUDE.md`](../CLAUDE.md) (always-on rules) and the public
[`README.md`](../README.md). If anything here conflicts with the code, the code wins — but this
captures the *why* behind it, the design contract, and the decisions/rationale gathered over five
rounds of review.

Live: **https://zachtheyek.github.io/nadi-demokrasi/**

---

## 1. What this is (and who it's for)

A single-page, **reproducible, citable data-essay** measuring seven decades of Malaysian **federal
general elections (1955–2022, GE-00…GE-15)** with the standard tools of political science. It is a
scrollytelling-lite essay: **twelve indicator sections**, each = one chart (its full history) +
short prose + a collapsible "How it's measured" (LaTeX + plain English). Built for two audiences at
once: the **layman** (headline + plain-English takeaway that stands alone) and the **analyst**
(exact method, formula, caveats, downloadable data).

Three non-negotiable principles (inherited from the sibling projects' house style):

- **Neutrality.** Descriptive, never a partisan verdict on any party, coalition, person, or
  community. Every metric is framed as a *measurement*; caveats ship on the page, not buried. Credit
  Thevesh (the data author) everywhere.
- **Interpretability.** First the number, then what it means. Direct labels over legends. Every
  chart must **stand on its own** — a reader who sees only the chart should get the story.
- **Reproducibility / "nothing hard-coded."** Every figure, chart point, annotation, and most prose
  numbers are **computed from the data at render time**, so the page updates itself as new elections
  are added. Historical *event names* (e.g. "Reformasi") are the only hand-written exception, and
  they're keyed by year so they're drift-safe.

---

## 2. Stack & file map

Vite + **vanilla TypeScript** + **plain CSS** (no framework). **Space Grotesk** (self-hosted via
`@fontsource`) for UI/headers/labels; **Georgia serif** for body prose. **Light theme** — this is a
deliberate exception to the sibling projects' dark theme.

```
nadi-demokrasi/
  scripts/
    compute_indicators.py   # reads ../meco-data/out/*.parquet → public/data/indicators.{json,csv} + a data zip
    gen_og.mjs              # default 1200×630 OG card (satori→resvg) → dist/og-default.png
    prerender.mjs           # per-section plot OG PNGs + /s/<id>/ share pages (resvg + woff)  ← §8
  src/
    main.ts                # THE app: chart engine + sections() + render() + cite modal + share/hover
    style.css              # all styling
    vite-env.d.ts
  public/data/             # GENERATED, git-ignored (indicators.json/csv + nadi-demokrasi-data.zip)
  .github/workflows/
    deploy.yml             # build+publish, push + workflow_dispatch ONLY (no schedule)
    drift-review.yml       # weekly: if MECo moved, Claude reconciles prose, opens a PR  ← §7
  DATA_VERSION             # tracked: the MECo commit the prose was last reconciled against  ← §7
  CLAUDE.md                # lean always-on rules + the Drift contract
  README.md                # public
  docs/CONTEXT.md          # this file
  index.html, package.json, vite.config.ts (base:"/nadi-demokrasi/"), tsconfig.json, LICENSE (MIT)
```

`src/main.ts` is the whole app. The single most important function is **`sections()`** — it returns
the array of 12 `Sec` objects (id, title, question, headline `now`+`nowCap`, `share` text, chart
`opts`, `body` prose, optional `note`, and `method`). **`sections()` is the source of truth**;
`render()` lays it out and `renderChart()` draws each `opts`.

Local dev: `npm install` → `npm run data` → `npm run dev`. Build: `npm run build` (vite + gen_og +
prerender). Data needs `pandas`/`pyarrow`/`numpy` + a `../meco-data` checkout (or `MECO_OUT` path).

---

## 3. Data pipeline

Data comes from **MECo** (the Malaysian Election Corpus by **Thevesh Thevananthan**,
[electiondata.my](https://electiondata.my), CC0, peer-reviewed in *Scientific Data* 13, 190 (2026)),
via the shared **[`meco-data`](https://github.com/zachtheyek/meco-data)** foundation (its
`pipeline.py` emits `out/*.parquet`). Not affiliated with the author — **credit him on the page and
in the README** (link author → x.com/Thevesh, data → electiondata.my).

`compute_indicators.py` reads `../meco-data/out/{ballots,contests,seat_lineage,lookup_*}.parquet`,
computes one row per federal GE, and writes `public/data/indicators.{json,csv}` plus a downloadable
zip. **`public/data` is git-ignored** — generated locally (`npm run data`) or in CI. The path is
overridable with the `MECO_OUT` env var (used by drift-review CI).

Key modelling choices (do **not** "fix" naively):
- **Unit of analysis = "bloc"**: a candidate's coalition where they ran in one, else their party
  (non-aligned parties are their own bloc; independents share `BEBAS`). Governments form by
  coalition, so this is the right unit — but it *is* a choice (party-level would give different
  fragmentation/disproportionality; noted in limitations).
- **Cross-election matching collapses pure renames** (PERIKATAN→BN, BA→PR→PH) via
  `lookup_*_succession` "replace" edges, so a rebrand isn't counted as change; genuine splits/merges
  are. Used by volatility and turnover.
- **`json.dumps(..., allow_nan=False)` from the rows list** (not the DataFrame) — pandas turns
  `None`→`NaN`, which is invalid JSON.

Row fields emitted: `election, year, n_seats, n_blocs, enp_votes, enp_seats, gallagher,
malapportionment, volatility, turnover, turnout, women_pc, malay_pc, chinese_pc, indian_pc,
em_bumi_pc, cand_per_seat, three_plus_pc, marginal_pc, winner, winner_vote_pc, winner_seat_pc,
winner_seat_bonus, top_blocs`. (`top_blocs` = top-5 by seats with labels — the drift-proof source of
the "three biggest blocs — PH, PN, BN" phrase.)

---

## 4. The twelve indicators (narrative order)

Ordered so the story flows: the vote-to-seat machine → the party system → dynamics → participation &
representation. Each has an equation number **only if it carries a `method.eq`** (10 of the 12 do;
dominance and ethnicity use plain-English `method.text`). Equation numbers are assigned **in
document order** by `methodHTML` — add/remove/reorder an equation-bearing section and they
renumber automatically; keep them 1..N with no gaps.

| # | Section (id) | Measures | Field(s) | Eq | Key facts (2022 unless noted) |
|---|---|---|---|---|---|
| 1 | Disproportionality (`disproportionality`) | Gallagher LSq — total vote↔seat gap | `gallagher` | (1) | 7.9, down from peak **24.0 (2004)** |
| 2 | The winner's bonus (`seat-bonus`) | seat% − vote% (mechanical FPTP reward) | `winner_seat_pc`,`winner_vote_pc` | (2) | **−1.1** (vanished); peaked +27.2 (1978); minority-of-vote wins 1969/2013/2018 |
| 3 | Malapportionment (`malapportionment`) | Samuels–Snyder — unequal voters/seat | `malapportionment` | (3) | **18.0%** record; low 8.5% (1959); >15% is extreme |
| 4 | The end of the majority party (`dominance`) | winner's vote share | `winner_vote_pc` | — | **38%**, from 82% (1955); 2/3 lost 2008 |
| 5 | Fragmentation (`fragmentation`) | Laakso–Taagepera ENP (seats & votes) | `enp_seats`,`enp_votes` | (4) | **3.6** record; from 1.0 (1955); top-3 blocs PH/PN/BN |
| 6 | Multi-cornered contests (`multi-cornered`) | mean candidates/seat | `cand_per_seat`,`three_plus_pc` | (5) | **4.3**; low 2.0 (2004); **96% 3+-cornered** |
| 7 | Volatility (`volatility`) | Pedersen vote-share swing | `volatility` | (6) | **37**; big: 1990/1999/1959; calm: 1982/2013 |
| 8 | Seats changing hands (`turnover`) | share of seats that flip bloc (via lineage) | `turnover` | (7) | **53%** record; 39% (2008) |
| 9 | Marginal seats (`marginal`) | share won by <5pp | `marginal_pc` | (8) | **16.2%**; peak 18.5% (2013); "one in 6" |
| 10 | Turnout (`turnout`) | ballots/electors | `turnout` | (9) | **73%**; range 69–84%; peak 83.9% (2013) |
| 11 | Women in Parliament (`women`) | share of women MPs | `women_pc` | (10) | **13.1%**; peak 14.4% (2018); ~30% benchmark |
| 12 | Parliament's ethnic makeup (`ethnicity`) | MP share by ethnicity | `malay/chinese/em_bumi/indian_pc` | — | ethnic-Chinese MPs 29%→**20%**; Malay 53%; descriptive only |

**Seat turnover (§8) uses `seat_lineage.parquet`** — the boundary-based lineage that threads each of
the 822 *current* seats back through Malaysia's redelineations (electiondata.my's dominant-ancestor
lineage; the same data undi-wrapped uses). We join lineage→contests on `(date,state,seat)`, take the
**dominant ancestor** per `(slug,date)` (max valid votes), canonicalise the winning bloc, and compare
consecutive elections over the seats present in both. It's **approximate in redelineation years** (a
seat can split/merge) — that caveat is on the page. This is the one indicator earlier called "too
fragile"; lineage is what makes it defensible.

**The 2008 insight worth preserving:** vote **volatility** in 2008 was moderate (BN kept ~51% of the
vote) but seat **turnover** was high (39%) — the "political tsunami" was a *seat* event, not a
vote-share one. Volatility (§7), turnover (§8) and the seat-bonus (§2) cross-link to make this point;
don't flatten it.

---

## 5. The chart engine (`renderChart` in main.ts)

Hand-built inline SVG, **Tufte-compliant**: no gridlines, range-frame axes, a single accent on the
focal series, **direct end-labels instead of legends**, and a marker layer so each plot stands alone.
`ChartOpts` fields:

- **`series[]`** `{label,color,focal?,y}` — up to 4 lines. `focal:true` → thicker line + it's the
  "story" line (usually red). End-labels (series name + latest value) are drawn at the right and
  **de-collide vertically**.
- **`points[]`** `{year,value,tag,place?}` — labelled callouts (value on top, `'YY (tag)` below;
  empty tag → just `'YY`). `place`: `above`/`below` (auto-flips near edges) or **`left`/`right`**
  (label beside the point — used for dips that would sit on the line). Callouts at the **first/last
  point** anchor to the correct side so they don't hit the y-axis. A **box de-collision** pass keeps
  every callout clear of every other label.
- **`yRefs[]`** `{at,to?,label,side?}` — a horizontal line (`at`), or a shaded **band** (`at`→`to`).
  Label sits *below* the line; `side:"right"` moves it right (used for malapportionment's 15% line so
  it clears the data).
- **`xBands[]`** — faint shaded vertical period (currently unused; replaced in volatility by…).
- **`xLines[]`** `{year,label}` — a vertical dashed event line with a top label (e.g. `'08 political
  tsunami`).
- **`gap`** `{year,label}` (2-series only) — a vertical connector between the two lines at a year,
  with a two-line tag (label + `'YY`) above (the seat-bonus "+27.2pp bonus / '78").
- **`gapFill`** — faint shading between two series (the seat-bonus gap).
- **`yMin`/`yMax`** — override the auto range (auto = data max × ~1.16 headroom, min(0,data)).
  Volatility sets `yMax = max×1.35` so adjacent tall peaks can stack.

x-axis year labels are **apostrophe-prefixed** (`'55`,`'64`…). Every chart is verified to have
**zero label overlaps** (a programmatic sweep — see §11).

**Hover interaction:** each data point has a transparent 9px hit-circle (`.dot`). On hover, a
**visible highlight dot is drawn on every series at that year**, and a **unified tooltip** shows one
row per series (`{year} {label}` / value in the line's colour) with the winner named **once** at the
bottom — e.g. `1978 Seat share / 84% / 1978 Vote share / 57% / won by BN`. Dots clear on mouse-out.

---

## 6. The highlight-colour system (important, easy to get wrong)

Prose emphasis uses **coloured spans, never bold**. The rule, applied consistently:

- A highlighted **number takes the colour of the chart line it refers to.** `.hl` = red
  (`#b3402f`), `.hl-t` = teal (`#2f6f6b`), `.hl-g` = gold (`#c08a2d`), `.hl-s` = slate (`#4f6d7a`).
  So on the seat-bonus chart, `57%` (vote line, teal) is `.hl-t` and `84%` (seat line, red) is `.hl`.
  On the gold turnout chart, all turnout values are `.hl-g`. On the 4-line ethnicity chart each
  group's value takes its line's colour.
- **Purely conceptual emphasis** (not a chart value — "minority of the vote", period names, the
  seat-bonus *gap* value which isn't a single line, thresholds like `~30%` that aren't the data
  line) → **teal (`.hl-t`) is the single neutral accent.** This was a deliberate decision.

The helpers `hl/hlt/hlg/hls` live inside `sections()`. When you touch prose, keep this rule — it was
audited across all 12 sections and is part of the design contract.

---

## 7. Self-update + human-gated drift review (how the site stays current)

The **quantitative** layer self-updates; the **editorial** layer is reconciled by a Claude action.

- **`DATA_VERSION`** (tracked file) = the MECo commit the prose was last reconciled against.
- **`deploy.yml`** builds from the live `meco-data` foundation and publishes — on **push +
  workflow_dispatch only** (no weekly schedule). It stamps the built MECo commit into
  `dist/data-version.txt`.
- **`drift-review.yml`** (weekly, Sun 20:52 UTC): if MECo moved past `DATA_VERSION`, it regenerates
  the figures and runs **`anthropics/claude-code-action`** (SHA-pinned v1.0.85, Aetherscan-style
  prompt) to reconcile the **hand-written** prose against the new numbers, bump `DATA_VERSION`, and
  **open a PR**. **Merging that PR is what publishes new data** — so a new election is always reviewed
  first. It no-ops when nothing moved; dedups on a `<!-- nadi-drift meco=<sha> -->` marker.
- **Auth:** the workflow reads **`secrets.ANTHROPIC_API_KEY`** (the maintainer adds it via
  `gh secret set ANTHROPIC_API_KEY --repo zachtheyek/nadi-demokrasi`). To use a Claude subscription
  instead, swap the `anthropic_api_key` line for `claude_code_oauth_token`/`CLAUDE_CODE_OAUTH_TOKEN`.
- **`CLAUDE.md` → "Drift contract"** is the spec the drift agent follows: it enumerates exactly what's
  **templated** (leave alone: all headline/chart/derived-prose numbers, top-bloc names, the
  conditional bonus caption, calm-year picks, citation range, etc.) vs **hand-written** (verify each:
  indicator count/list, world-standard thresholds like Gallagher 12 / malapportionment 5% & 15% /
  women ~30%, trend claims, historical event names, section titles). **When you add prose that can go
  stale on a new GE, template it if you can, else add it to the drift contract.**

Because MECo only moves on a new general election (~every 5 years) or a rare correction, this is
near-zero-touch in steady state. Reference workflows: `~/Documents/BL-SETI/Aetherscan/.github/workflows`.

---

## 8. Per-section share cards (OG images that embed the plot)

`scripts/prerender.mjs` renders, for **each of the 12 sections**, a standalone **1200×630 OG PNG of
that section's plot** (title + headline + the actual chart, built as SVG and rasterised with
**resvg** — which reads the **Space Grotesk `.woff`** via `fontBuffers`, so text renders without a
ttf) at `dist/og/s/<id>.png`, plus a tiny **`dist/s/<id>/index.html`** page carrying that image's OG
meta + a 1–2 sentence summary, redirecting a human visitor to the main page's `#<id>`.

Each section's **"Share" button** points at `/s/<id>/`, so a shared section link **delivers that
plot** as the tweet card; the tweet text is the section's `share` summary. The default full-dashboard
card is `gen_og.mjs` (satori). Both run in `npm run build` after vite.

**Maintenance gotcha:** `prerender.mjs` has its own compact **`specs[]`** (title, headline, series
keys+colours, summary) that **mirrors the chart shape of `sections()`**. It's a deliberate, minimal
duplication (the chart shapes are stable). **If you change a section's chart or title, update the
matching spec in `prerender.mjs`.**

---

## 9. UI details currently in place

- **Buttons:** top = `[X-logo] Share`, `↓ Data` (zip), `❝ Cite`. Bottom = `[X-logo] Share`, `Data`,
  `[GitHub-logo] Source`, `Cite`. Per-section = `[X-logo] Share`. Logos are inline SVG constants
  (`X_ICON`, `GH_ICON`).
- **Section links:** a GitHub-style `#` anchor tucked in the **left gutter** of each heading,
  **revealed on hover**, click copies the deep link (`SITE#<id>`) + toast. Scroll-to-hash on load.
- **Cite modal:** APA + BibTeX (dashboard + the MECo `@article`), copy-to-clipboard + toast.
  Attribution reads *"Analysis by [Zach Yek](x.com/zachtheyek) (ORCID: [0000-0002-2532-4883]),"*
  and links the Malaysian Election Corpus → electiondata.my, Thevesh → x.com/Thevesh. The citation
  author name/ORCID were **confirmed via the ORCID public API** (credit name "Zach Yek").
- **Data download:** a single **zip** (`indicators.csv` + `.json` + `compute_indicators.py` + a
  reproduce-`README.txt`), generated by `compute_indicators.py`.
- **Equations:** real LaTeX via **KaTeX**, in a collapsible `<details>` "How it's measured", numbered
  globally, with plain-English variable explanations. Inline fractions in prose use **spaces**
  (`1 / n`, not `1/n`). Sections that don't need an equation use `method.text`.

---

## 10. Decisions & rationale (so you don't re-litigate them)

- **Section order** was reworked so the winner's bonus (mechanical FPTP reward) sits **before**
  malapportionment (structural), both decomposing disproportionality; then dominance→fragmentation
  (party system), multi-cornered, volatility→turnover (dynamics), marginal, then participation
  (turnout) and representation (women→ethnicity).
- **Neutral highlight colour = teal.** (See §6.)
- **Ethnicity section is purely descriptive**, headlines the ethnic-Chinese MP decline (29%→20%, the
  sharpest factual shift) and carries an explicit *"not a verdict on any community"* note. This is
  sensitive; keep it descriptive and neutral. (If a future maintainer wants a different headline —
  e.g. a diversity summary rather than one group — it's a one-line change.)
- **Volatility spike/calm labels** carry short, sourced historical context (1959 "opposition
  emerges", 1982 "BN unchallenged", 1990 "UMNO splits" [Semangat 46], 1999 "Reformasi", 2013 "BN–PR
  rematch", 2008 "political tsunami"), keyed by year in a `volContext` lookup so a future spike with
  no entry just shows value+year (drift-safe).
- **Efficiency gap / partisan bias were deliberately NOT built.** They answer "which side does the map
  favour?" but are *defined for two-party competition*; Malaysia is multi-bloc/multi-cornered, so
  there's no clean wasted-vote split or 50/50 counterfactual — a single number would mislead.
  Explained in on-page limitations. **Turnout-by-age** needs the individual **voter rolls**
  (`voter_rolls/ge15_2022.parquet`, ~21M rows, on the lake) — a single-election cross-section, not a
  time series, and it's the flagship **[undi-generasi](https://zachtheyek.github.io/undi-generasi/)**'s
  domain; linked, not duplicated.

---

## 11. Gotchas & how to verify

- **iCloud** (the `Projects` folder is synced): before every commit, clean conflict copies —
  `find public dist -regextype posix-extended -regex '.* [0-9]+\.(json|png|zip)' -delete` and the
  `.git` equivalent (see the collection HANDOFF §5). `git config http.version HTTP/1.1` for pushes.
- **Local `npm run build` is fine now** (`public/data` is only a few files). CI (Linux) does the full
  build in ~30s including prerender.
- **Browser verification** uses the Claude Preview MCP against a dev server (`launch.json` — note:
  the preview MCP is rooted at the *cwd*, so there's a `Projects/.claude/launch.json` with a
  `nadi-demokrasi` entry pointing at `in_progress/nadi-demokrasi`, port 5183, base `/nadi-demokrasi/`).
  Quirks learned: (a) the **screenshot captures full-page-from-top** and can't scroll — isolate a
  section by `display:none`-ing the others via `preview_eval`, then screenshot; (b) **`#<id> svg`
  matches the X-logo SVG in the share button first** — always query **`#<id> .chart svg`** for the
  chart; (c) `preview_eval` right after `location.reload()` throws "navigated" — wait ~2.5s.
- **Overlap sweep** (run after any chart change): for each `.chart svg`, compare bounding boxes of all
  non-`.axt` `<text>` — must be **0 overlaps** across all 12. There's a ready eval snippet in the
  session history; the invariant is zero.
- **resvg** reads woff via `font.fontBuffers` (tested) — that's how per-section OG text renders.
- **satori gotchas** (gen_og): every `<div>` with >1 child needs `display:flex`; no emoji font
  (draw chevrons as bordered/rotated divs); it outlines text so resvg needs no fonts for *that* path.
- **Seat identity is not stable across delimitations** — never match seats by name across elections;
  use `seat_lineage`. (This is why turnover is lineage-based.)

Enabling Pages / deploy gotchas (once per repo) are in the collection HANDOFF (`in_progress/HANDOFF.md`
§3): the `github-pages` env branch-policy and the HTTP-400-on-first-push buffer fix.

---

## 12. Open / future work

- **Efficiency gap / partisan bias** — the right *question* (direction of map bias), but not sound as
  a single number in multi-bloc FPTP (§10). If ever attempted, it'd need a defensible two-side
  framing + a swing model the corpus doesn't pin down.
- **Turnout by age** — belongs in undi-generasi (needs voter rolls). Linked from limitations.
- **Drift-review** needs `ANTHROPIC_API_KEY` set before it can open PRs (§7).
- **`prerender.mjs` specs** duplicate `sections()` chart shapes — a future refactor could share a
  single source (would need to decouple `sections()` from the DOM/KaTeX imports so it can run in
  Node).
- Node-20-deprecation warnings on the Actions are cosmetic (same across all the sibling repos).
- Announcement posts (X/LinkedIn/Reddit) are **not** yet drafted for this project — see the
  collection HANDOFF §10 for the template/quality bar when the user asks.

---

## 13. Session history (five review rounds, all deployed)

The dashboard was built by a prior session, then refined over five rounds of the maintainer's
numbered feedback:

1. **R1** — Tufte chart rewrite (data-driven), centred headline caption, LaTeX-dropdown equations,
   colour highlights (not bold), Cite button, the self-updating CI + git-ignored data, an academic
   critique → on-page explainers + expanded limitations.
2. **R2** — added **malapportionment** (7th indicator); reordered to decompose disproportionality;
   charts made to stand alone; per-section deep-links + X-share; ORCID in the citation.
3. **R3** — annotation spacing fixes (ref labels below the line, parenthetical tags, de-collision);
   more prose templating; **built the drift-review pipeline** (deploy on push-only + `drift-review.yml`
   + `DATA_VERSION` + the CLAUDE.md drift contract).
4. **R4** — three more indicators (**multi-cornered, marginal, women**) → 10; left/right callout
   placement; x-axis apostrophes; hover anchor + X logo; buttons reordered; **Data → zip**; a
   number-consistency pass.
5. **R5 (this session)** — a large multi-stage pass (7 commits, deploy after each): **seat turnover**
   (via lineage) + **ethnic makeup** → **12 indicators**; reorder (bonus before malapportionment);
   the `xLines`/side-refs/two-line-gap engine additions + the **unified hover tooltip**; the
   **volatility historical-context overhaul**; the **line-matched highlight system** (teal = neutral);
   `[X-logo] Share` + GitHub-logo Source + full citation links; **per-section share cards that embed
   the plot** (`prerender.mjs`); methods & limitations rewritten (efficiency-gap/partisan-bias
   explained, turnout-by-age noted).

The full per-round detail lives in the collection doc `in_progress/HANDOFF.md` (the nadi-demokrasi
row + §7 note), which is where a *new session* should start; this file is the deep dive for someone
working inside the repo.
