# CLAUDE.md

Always-on rules for any coding agent in this repo. Canonical detail lives in [README.md](README.md).

## Project

**Nadi Demokrasi** — a single-page, reproducible data-essay measuring seven decades of Malaysian
general elections with standard political-science indicators (Gallagher disproportionality,
Samuels–Snyder malapportionment, the winner's seat bonus, winner's vote share, effective number of
parties, multi-cornered contests, Pedersen volatility, marginal-seat share, turnout, and women's
representation — ten sections in narrative order). Vite + vanilla TS + plain CSS; **light theme**. Charts are
hand-built inline SVG. Equations render via KaTeX. All data comes from **MECo** (the Malaysian
Election Corpus by Thevesh Thevananthan, CC0) via the sibling [`meco-data`](https://github.com/zachtheyek/meco-data)
foundation. Not affiliated with the author — **credit Thevesh on the page and in the README**.

## Run / build

```bash
npm install
npm run data     # scripts/compute_indicators.py: reads ../meco-data/out -> public/data/*.json (git-ignored)
npm run dev
npm run build    # vite build + OG card (scripts/gen_og.mjs)
```

`npm run data` needs `pandas`, `pyarrow`, `numpy` and a `../meco-data` checkout (override the path
with `MECO_OUT`). `public/data/` and `dist/` are generated, never committed.

## House rules (don't break these)

- **Nothing hard-coded that can be computed.** Every figure, chart point, and derived phrase is
  recomputed from `public/data/indicators.json` at render time (see `sections()` in `src/main.ts`),
  so the page updates itself as elections are added. When a claim depends on the data, template it —
  don't type the number.
- **Neutrality.** Descriptive, never a partisan verdict on any party or person. Frame every metric
  as a measurement and explain the method. Caveats ship on the page, not buried.
- **Each chart stands on its own.** Tufte rules: no gridlines, range-frame axes, a single accent
  (clay red `--accent`) on the focal series, direct end-labels (no legend), labelled peak/dip
  callouts with the value and an apostrophe-year, reference lines/bands and shaded periods where the
  prose names a threshold or era. Reference-line labels sit *below* the line; callout tags read
  `'YY (tag)`; labels must not overlap (a de-collision pass handles this — keep it working).
- **Highlight, don't bold.** Key results in prose use colored spans (`.hl` red / `.hl-t` teal /
  `.hl-g` gold), never `<b>`.
- **Equations:** real LaTeX in the collapsible "How it's measured" dropdown, numbered **sequentially
  in document order** — `methodHTML` assigns `(1),(2),…` to sections that have `method.eq`. If you
  add/remove/reorder an equation-bearing section, the numbering must stay 1..N with no gaps.
- **Data is generated, not committed** — never commit `public/data/` or `dist/`.

## Data & deploy (self-updating, human-gated)

- `deploy.yml` builds from the live `meco-data` foundation and publishes — on **push and manual
  dispatch only** (no schedule). It stamps the built MECo commit into `dist/data-version.txt`.
- `DATA_VERSION` (tracked) is the MECo commit the **prose was last reconciled against**.
- `drift-review.yml` runs weekly: if MECo moved past `DATA_VERSION`, it regenerates the figures and
  runs Claude to reconcile the hand-written prose (below), bumps `DATA_VERSION`, and opens a PR.
  **Merging that PR is what publishes new data** — so a new election is always reviewed first.

## Drift contract (READ before a drift review)

When the data changes, most of `src/main.ts` self-corrects. Do **not** touch the templated layer.
Check only the hand-written claims, each against `public/data/indicators.json`:

**Templated — leave alone:** every headline `now`, chart point, callout, peak/dip/annotation; the
minority-win count; the two-thirds-lost year; `top_blocs` names ("three biggest blocs — …"); the
seat-bonus caption + tail (vanished / all-but-vanished / positive, "first time…", "hung parliament");
the calm-period band + its decade phrase; turnout range/drop; the seat-count-growth sentence; the
citation year range/date; the meta counts.

**Hand-written — verify each still holds under the new numbers:**

1. **Indicator count & list.** The lede count ("Here are N") is templated from `secs.length`, but the
   hero `dek`'s indicator list and the README "N indicators" table are hand-written — update them only
   if a section is genuinely added or removed.
2. **World-standard thresholds & claims** (paired with hard-coded `yRefs`):
   - Gallagher: "above about 12 is high by world standards; established proportional systems sit near
     2–5" ↔ `yRefs [{2–5},{12}]`.
   - Malapportionment: "most democracies ≤ 5%" ↔ `yRef {5}`, and **"above ~15% is among the most
     malapportioned in the democratic world"** — re-check the ~15% wording still fits the latest peak.
   - Marginal: the **< 5 percentage-point** definition of "marginal" is a fixed convention (change only
     deliberately).
   - Women: **"~30% many democracies treat as a floor"** ↔ `yRef {30}`, and "half of the population" —
     stable benchmarks; adjust only if a sentence reads wrong against the new value.
   These reflect the comparative-politics literature and rarely change; adjust wording only if the
   new data makes a sentence read wrong (e.g. the metric crosses a stated band).
3. **Directional / trend claims** that assume the current trajectory — re-check the direction still
   holds: malapportionment "has not gone away"; fragmentation "until {year}… a fragmented result
   closed the gap"; multi-cornered "a straight fight … then they splintered"; marginal "long dominated
   by safe seats … has risen sharply"; dominance "lost for good" + "from a dominant-party system to
   competitive, coalition-by-coalition politics"; turnout "the most fiercely contested election of the
   BN era" (tied to the peak year) and the "**despite** millions of newly-enrolled young voters"
   framing (assumes turnout *fell*); women "climbed … then eased" (assumes the recent dip). If the
   newest election reverses a trend, reword to match.
4. **Historical event references** — stable, almost never drift, but confirm they still read right
   next to the newest data: the 2008 "political tsunami" volatility note; "Reformasi"; "Undi18";
   "BN era"; "one-and-a-half-party system".
5. **Section titles & questions** — confirm each still fits the latest picture (e.g. "The end of the
   majority party" would need rethinking if a party regained a majority).
6. **README** indicator table figures (the parenthetical "peaked 24.0 in 2004", "8%→18%", etc.).

Prefer widening a template over hard-coding a new number. Keep every edit neutral and in-voice, keep
equations numbered 1..N, keep each chart standalone, and keep Thevesh's credit intact.
